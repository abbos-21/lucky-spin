import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { validateTelegramAuth } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { CONFIG } from '../config/constants';

const router = Router();

// ─── Weighted random segment picker ────────────────────────────────────────────
function pickSegment(): number {
  const totalWeight = CONFIG.SPIN_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < CONFIG.SPIN_SEGMENTS.length; i++) {
    r -= CONFIG.SPIN_SEGMENTS[i].weight;
    if (r < 0) return i;
  }
  return CONFIG.SPIN_SEGMENTS.length - 1;
}

// ─── Streak logic ─────────────────────────────────────────────────────────────
function calculateStreak(
  lastSpinDate: string | null,
  today: string,
  currentStreak: number,
  streakShield: boolean
): { newStreak: number; shieldConsumed: boolean } {
  if (!lastSpinDate) return { newStreak: 1, shieldConsumed: false };
  if (lastSpinDate === today) return { newStreak: currentStreak, shieldConsumed: false }; // already spun today

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastSpinDate === yesterdayStr) {
    // Consecutive day — streak continues
    return { newStreak: currentStreak + 1, shieldConsumed: false };
  }

  // Missed at least one day
  if (streakShield) {
    // Shield absorbs the break — reset to 1 and consume shield
    return { newStreak: 1, shieldConsumed: true };
  }

  return { newStreak: 1, shieldConsumed: false };
}

// ─── Apply reward to user data ─────────────────────────────────────────────────
async function applyReward(
  userId: bigint,
  segmentIndex: number,
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
) {
  const seg = CONFIG.SPIN_SEGMENTS[segmentIndex];

  switch (seg.type) {
    case 'coins': {
      const amount = parseInt(seg.value, 10);
      await tx.user.update({ where: { id: userId }, data: { coins: { increment: amount } } });
      break;
    }
    case 'ticket': {
      // Tickets are tracked as coins for now (10 coins = 1 ticket equivalent)
      // In Phase 6 a dedicated tickets field can be added
      await tx.user.update({ where: { id: userId }, data: { coins: { increment: 50 } } });
      break;
    }
    case 'collectible': {
      // Award a random collectible from the rarity tier
      // IDs match the 10-theme × 10-item structure in client/src/config/collectibles.ts
      const rarity = seg.value; // "common" or "rare"
      const commonThemes = ['animals', 'nature', 'food', 'music', 'sports', 'travel', 'fantasy'];
      const rareThemes   = ['ocean', 'space', 'gems'];
      const themes = rarity === 'rare' ? rareThemes : commonThemes;
      const theme = themes[Math.floor(Math.random() * themes.length)];
      const n = Math.floor(Math.random() * 10) + 1;
      const collectibleId = `${theme}_${n}`;

      // Upsert — ok if already owned, just ignore
      await tx.userCollectible.upsert({
        where: { userId_collectibleId: { userId, collectibleId } },
        create: { userId, collectibleId },
        update: {},
      });
      break;
    }
    case 'jackpot': {
      // 500 coins + treat tickets as extra coins
      await tx.user.update({ where: { id: userId }, data: { coins: { increment: 500 } } });
      break;
    }
  }
}

/**
 * POST /api/spin
 *
 * Body: { isAdSpin?: boolean }
 *
 * Free spin: 1 per day (gated by lastSpinDate).
 * Ad spin: max 2/day (gated by adSpinsToday). Ad reward itself is
 * credited separately via POST /api/earn/ad-reward — this endpoint
 * only unlocks the extra spin slot.
 */
router.post(
  '/',
  rateLimitPerUser(5, 60 * 1000),
  validateTelegramAuth,
  async (req, res) => {
    try {
      const userId = BigInt(req.telegramUserId!);
      const isAdSpin = Boolean(req.body?.isAdSpin);
      const today = new Date().toISOString().split('T')[0];

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      if (user.isBanned) return res.status(403).json({ error: 'Account suspended.' });

      // ── Spin gate ──────────────────────────────────────────────────────
      if (!isAdSpin) {
        // Free spin — 1 per day
        if (user.lastSpinDate === today) {
          return res.status(429).json({ error: 'Free spin already used today.' });
        }
      } else {
        // Ad spin — max 2 per day
        const todayAdSpins = user.lastSpinDate === today ? user.adSpinsToday : 0;
        if (todayAdSpins >= CONFIG.MAX_AD_SPINS_PER_DAY) {
          return res.status(429).json({ error: 'Ad spin limit reached for today.' });
        }
      }

      // ── Pick segment ───────────────────────────────────────────────────
      const segmentIndex = pickSegment();
      const segment = CONFIG.SPIN_SEGMENTS[segmentIndex];

      // ── Streak ────────────────────────────────────────────────────────
      const { newStreak, shieldConsumed } = calculateStreak(
        user.lastSpinDate,
        today,
        user.streak,
        user.streakShield
      );
      const newLongest = Math.max(user.longestStreak, newStreak);

      // ── Active days ───────────────────────────────────────────────────
      const activeDayIncrement = user.lastActiveDate !== today ? 1 : 0;

      // ── Build user update ──────────────────────────────────────────────
      const spinCountIncrement = isAdSpin ? 0 : 0; // spin log is the source of truth
      const userUpdate: Record<string, unknown> = {
        streak: newStreak,
        longestStreak: newLongest,
        lastSpinDate: today,
        lastActiveDate: today,
        ...(activeDayIncrement > 0 ? { activeDays: { increment: activeDayIncrement } } : {}),
        ...(shieldConsumed ? { streakShield: false } : {}),
      };

      if (isAdSpin) {
        // Increment or reset counter depending on whether today is new
        userUpdate.adSpinsToday = user.lastSpinDate === today
          ? { increment: 1 }
          : 1;
      } else {
        // Reset ad spin counter on new free spin day
        userUpdate.adSpinsToday = 0;
      }

      // ── Check if this is the user's first spin (for referral bonus) ────
      const priorSpinCount = await prisma.spinLog.count({ where: { userId } });
      const isFirstSpin = priorSpinCount === 0;

      // ── Transaction: apply reward + update user + log spin ────────────
      await prisma.$transaction(async (tx) => {
        await applyReward(userId, segmentIndex, tx as any);
        await tx.user.update({ where: { id: userId }, data: userUpdate });
        await tx.spinLog.create({
          data: {
            userId,
            rewardType: segment.type,
            rewardValue: segment.value,
            isAdSpin,
          },
        });

        // ── Referral bonus: award 100 coins to both on first spin ──────
        if (isFirstSpin) {
          const referral = await tx.referral.findFirst({
            where: { referredId: userId, bonusAwarded: false },
          });
          if (referral) {
            await Promise.all([
              tx.user.update({
                where: { id: referral.referrerId },
                data: { coins: { increment: 100 } },
              }),
              tx.user.update({
                where: { id: userId },
                data: { coins: { increment: 100 } },
              }),
              tx.referral.update({
                where: { referrerId_referredId: { referrerId: referral.referrerId, referredId: userId } },
                data: { bonusAwarded: true },
              }),
            ]);
          }
        }
      });

      // Fetch updated user for response
      const updatedUser = await prisma.user.findUnique({ where: { id: userId } });

      return res.json({
        segmentIndex,
        reward: {
          type: segment.type,
          value: segment.value,
          label: segment.label,
        },
        streak: {
          current: newStreak,
          longest: newLongest,
          shieldConsumed,
        },
        user: {
          coins: updatedUser?.coins,
          streak: updatedUser?.streak,
          adSpinsToday: updatedUser?.adSpinsToday,
          lastSpinDate: updatedUser?.lastSpinDate,
        },
      });
    } catch (err) {
      console.error('Spin error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
