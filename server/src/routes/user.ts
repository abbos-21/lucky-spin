import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { validateTelegramAuth } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';

const router = Router();

/**
 * POST /api/user/init
 *
 * Validates Telegram auth, creates user if not exists, updates profile,
 * tracks active days, and returns full user profile.
 */
router.post(
  '/init',
  rateLimitPerUser(10, 60 * 1000), // 10 req/min
  validateTelegramAuth,
  async (req, res) => {
    try {
      const userId = BigInt(req.telegramUserId!);
      const tgUser = req.telegramUser!;
      const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

      // Upsert user — create if new, otherwise update profile fields
      let user = await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name ?? null,
          photoUrl: tgUser.photo_url ?? null,
          lastActiveDate: today,
          activeDays: 1,
        },
        update: {
          username: tgUser.username ?? undefined,
          firstName: tgUser.first_name ?? undefined,
          photoUrl: tgUser.photo_url ?? undefined,
        },
      });

      // Track active days — increment if this is a new calendar day
      if (user.lastActiveDate !== today) {
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            activeDays: { increment: 1 },
            lastActiveDate: today,
          },
        });
      }

      // Update device fingerprint if provided
      const { fingerprintHash } = req.body;
      if (fingerprintHash && fingerprintHash !== user.deviceFingerprint) {
        user = await prisma.user.update({
          where: { id: userId },
          data: { deviceFingerprint: fingerprintHash },
        });
      }

      return res.json({ user: serializeUser(user) });
    } catch (err) {
      console.error('User init error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

/**
 * GET /api/user/profile
 *
 * Returns full user data for the authenticated user.
 */
router.get('/profile', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const today = new Date().toISOString().split('T')[0];

    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found. Call /init first.' });

    // Track active days on any authenticated request
    if (user.lastActiveDate !== today) {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          activeDays: { increment: 1 },
          lastActiveDate: today,
        },
      });
    }

    // Aggregate stats
    const [totalSpins, totalGameSubmissions, collectibles] = await Promise.all([
      prisma.spinLog.count({ where: { userId } }),
      prisma.miniGameScore.count({ where: { userId } }),
      prisma.userCollectible.findMany({
        where: { userId },
        select: { collectibleId: true, obtainedAt: true },
      }),
    ]);

    return res.json({
      user: serializeUser(user),
      stats: {
        totalSpins,
        totalGameSubmissions,
        collectiblesUnlocked: collectibles.length,
        collectibles,
      },
    });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Serialize user: convert BigInt id to string for JSON
function serializeUser(user: any) {
  return {
    ...user,
    id: user.id.toString(),
  };
}

export default router;
