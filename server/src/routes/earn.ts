import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { validateTelegramAuth } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { CONFIG } from '../config/constants';

const router = Router();

// ─── Helper: SystemConfig key for one-time social task completions ─────────────
function socialTaskKey(userId: bigint, task: string): string {
  return `social_task_${userId}_${task}`;
}

/**
 * POST /api/earn/ad-reward
 *
 * Called by the frontend AFTER a successful Adsgram ad view (result.done === true).
 * Body: { adType, sessionId, fingerprintHash }
 *
 * This is the ONLY endpoint that creates AdView records and credits points.
 */
router.post('/ad-reward', rateLimitPerUser(20, 60_000), validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const { adType, sessionId, fingerprintHash } = req.body;

    const validTypes = ['rewarded_spin', 'rewarded_score', 'earn_coins', 'earn_ticket'];
    if (!validTypes.includes(adType)) {
      return res.status(400).json({ error: 'Invalid ad type' });
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // ── Global daily cap ──────────────────────────────────────────────────────
    const todayTotal = await prisma.adView.count({
      where: { userId, viewedAt: { gte: todayStart } },
    });
    if (todayTotal >= CONFIG.MAX_REWARDED_ADS_PER_DAY + CONFIG.MAX_TASK_ADS_PER_DAY) {
      return res.status(429).json({ error: 'Daily ad limit reached.' });
    }

    // ── Per-type caps ─────────────────────────────────────────────────────────
    const typeCount = await prisma.adView.count({
      where: { userId, adType, viewedAt: { gte: todayStart } },
    });

    if ((adType === 'earn_coins' || adType === 'earn_ticket') && typeCount >= CONFIG.MAX_TASK_ADS_PER_DAY) {
      return res.status(429).json({ error: 'Earn task limit reached for today.' });
    }
    if (adType === 'rewarded_spin' && typeCount >= CONFIG.MAX_AD_SPINS_PER_DAY) {
      return res.status(429).json({ error: 'Ad spin limit reached for today.' });
    }
    if (adType === 'rewarded_score' && typeCount >= 1) {
      return res.status(429).json({ error: 'Score boost already used today.' });
    }

    // ── Task-ad cooldown (4h between earn_coins / earn_ticket) ───────────────
    if (adType === 'earn_coins' || adType === 'earn_ticket') {
      const lastTaskAd = await prisma.adView.findFirst({
        where: { userId, adType, viewedAt: { gte: todayStart } },
        orderBy: { viewedAt: 'desc' },
      });
      if (lastTaskAd) {
        const hoursSince = (Date.now() - lastTaskAd.viewedAt.getTime()) / 3_600_000;
        if (hoursSince < CONFIG.TASK_AD_COOLDOWN_HOURS) {
          const minutesLeft = Math.ceil((CONFIG.TASK_AD_COOLDOWN_HOURS - hoursSince) * 60);
          return res.status(429).json({
            error: `Next ad available in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
            minutesLeft,
            cooldownEndsAt: new Date(lastTaskAd.viewedAt.getTime() + CONFIG.TASK_AD_COOLDOWN_HOURS * 3_600_000).toISOString(),
          });
        }
      }
    }

    // ── Anti-bot: 15s minimum between any two ad views ────────────────────────
    const lastAdView = await prisma.adView.findFirst({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
    });
    if (lastAdView && Date.now() - lastAdView.viewedAt.getTime() < 15_000) {
      return res.status(429).json({ error: 'Too fast. Please wait a moment.' });
    }

    // ── Point value ───────────────────────────────────────────────────────────
    const pointsMap: Record<string, number> = {
      rewarded_spin:  CONFIG.POINTS_SPIN_AD,
      rewarded_score: CONFIG.POINTS_REWARDED_AD,
      earn_coins:     CONFIG.POINTS_TASK_AD,
      earn_ticket:    CONFIG.POINTS_TASK_AD,
    };
    const points = pointsMap[adType] ?? 0;

    // For rewarded_score: set adScoreBoost flag so the game submit route doubles the score
    const extraUserUpdate = adType === 'rewarded_score' ? { adScoreBoost: true } : {};

    // ── Atomic: log ad view + credit points ───────────────────────────────────
    const [adView] = await prisma.$transaction([
      prisma.adView.create({
        data: { userId, adType, pointsAwarded: points, sessionId: sessionId ?? null, fingerprintHash: fingerprintHash ?? null },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          pointsBalance: { increment: points },
          totalPointsEarned: { increment: points },
          ...extraUserUpdate,
        },
      }),
    ]);

    return res.json({ success: true, pointsAwarded: points, adViewId: adView.id });
  } catch (err) {
    console.error('Ad reward error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/earn/tasks
 *
 * Returns the full task list with current user state, cooldowns, and balances.
 */
router.get('/tasks', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [user, earnCoinsViews, earnTicketViews, rewardedSpinViews, rewardedScoreViews] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { pointsBalance: true, totalPointsEarned: true },
        }),
        prisma.adView.findMany({
          where: { userId, adType: 'earn_coins', viewedAt: { gte: todayStart } },
          orderBy: { viewedAt: 'desc' }, take: 1,
        }),
        prisma.adView.findMany({
          where: { userId, adType: 'earn_ticket', viewedAt: { gte: todayStart } },
          orderBy: { viewedAt: 'desc' }, take: 1,
        }),
        prisma.adView.count({
          where: { userId, adType: 'rewarded_spin', viewedAt: { gte: todayStart } },
        }),
        prisma.adView.count({
          where: { userId, adType: 'rewarded_score', viewedAt: { gte: todayStart } },
        }),
      ]);

    // Compute cooldown end times
    function cooldownEndsAt(lastView: typeof earnCoinsViews[0] | undefined): string | null {
      if (!lastView) return null;
      const end = lastView.viewedAt.getTime() + CONFIG.TASK_AD_COOLDOWN_HOURS * 3_600_000;
      return end > Date.now() ? new Date(end).toISOString() : null;
    }

    // Social task completion status (stored in SystemConfig)
    const [joinChannelConfig, referralRecord] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: socialTaskKey(userId, 'join_channel') } }),
      prisma.referral.findFirst({ where: { referrerId: userId, bonusAwarded: true } }),
    ]);

    const botName = process.env.BOT_USERNAME || 'LuckySpinBot';
    const referralLink = `https://t.me/${botName}?start=ref_${userId}`;

    return res.json({
      todayPoints: user?.pointsBalance ?? 0,
      totalPointsEarned: user?.totalPointsEarned ?? 0,
      tasks: {
        adTasks: [
          {
            id: 'earn_coins',
            adType: 'earn_coins',
            label: 'Watch ad → earn points',
            points: CONFIG.POINTS_TASK_AD,
            cooldownEndsAt: cooldownEndsAt(earnCoinsViews[0]),
            exhausted: earnCoinsViews.length > 0 && !cooldownEndsAt(earnCoinsViews[0]),
          },
          {
            id: 'earn_ticket',
            adType: 'earn_ticket',
            label: 'Watch ad → bonus ticket',
            points: CONFIG.POINTS_TASK_AD,
            cooldownEndsAt: cooldownEndsAt(earnTicketViews[0]),
            exhausted: earnTicketViews.length > 0 && !cooldownEndsAt(earnTicketViews[0]),
          },
        ],
        spinInfo: {
          adSpinsUsed: rewardedSpinViews,
          adSpinsMax: CONFIG.MAX_AD_SPINS_PER_DAY,
          pointsPerSpin: CONFIG.POINTS_SPIN_AD,
        },
        scoreBoostInfo: {
          used: rewardedScoreViews > 0,
          pointsForViewing: CONFIG.POINTS_REWARDED_AD,
        },
        socialTasks: [
          {
            id: 'join_channel',
            label: 'Join our channel',
            reward: '200 coins',
            rewardCoins: 200,
            completed: Boolean(joinChannelConfig),
            url: `https://t.me/${botName}`,
          },
          {
            id: 'invite_friend',
            label: 'Invite a friend',
            reward: '100 coins each',
            rewardCoins: 100,
            referralLink,
            referralCount: 0, // Phase 6 will track this properly
          },
        ],
      },
    });
  } catch (err) {
    console.error('Tasks error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/earn/social-task
 *
 * Claim a one-time social task reward.
 * Body: { taskType: 'join_channel' }
 *
 * Note: verification is trust-based in v1 (no API integration to verify channel membership).
 */
router.post('/social-task', rateLimitPerUser(5, 60_000), validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const { taskType } = req.body;

    if (taskType !== 'join_channel') {
      return res.status(400).json({ error: 'Unknown task type.' });
    }

    const key = socialTaskKey(userId, taskType);

    // Check if already claimed
    const existing = await prisma.systemConfig.findUnique({ where: { key } });
    if (existing) {
      return res.status(409).json({ error: 'Task already completed.' });
    }

    const REWARD_COINS = 200;

    // Atomic: mark task complete + credit reward
    await prisma.$transaction([
      prisma.systemConfig.create({ data: { key, value: new Date().toISOString() } }),
      prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: REWARD_COINS } },
      }),
    ]);

    return res.json({ success: true, coinsAwarded: REWARD_COINS });
  } catch (err) {
    console.error('Social task error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/earn/referral
 *
 * Returns the user's referral link and stats.
 */
router.get('/referral', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const botName = process.env.BOT_USERNAME || 'LuckySpinBot';
    const referralLink = `https://t.me/${botName}?start=ref_${userId}`;

    const [totalReferrals, activeReferrals] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({ where: { referrerId: userId, bonusAwarded: true } }),
    ]);

    return res.json({ referralLink, totalReferrals, activeReferrals });
  } catch (err) {
    console.error('Referral error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
