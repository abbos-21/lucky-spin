import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { validateTelegramAuth } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { CONFIG } from '../config/constants';

const router = Router();

function getTodayGame(): string {
  return CONFIG.GAME_SCHEDULE[new Date().getUTCDay()];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * POST /api/game/submit
 *
 * Body: { gameType: string, rawScore: number, isBoosted?: boolean }
 *
 * One submission per user per day. The `isBoosted` flag doubles the score
 * if the user watched the rewarded score ad (adScoreBoost flag on user).
 */
router.post(
  '/submit',
  rateLimitPerUser(3, 60 * 1000),
  validateTelegramAuth,
  async (req, res) => {
    try {
      const userId = BigInt(req.telegramUserId!);
      const { gameType, rawScore, isBoosted = false } = req.body;
      const today = getToday();
      const expectedGame = getTodayGame();

      if (!gameType || typeof rawScore !== 'number') {
        return res.status(400).json({ error: 'gameType and rawScore are required.' });
      }

      if (gameType !== expectedGame) {
        return res.status(400).json({ error: `Today's game is ${expectedGame}.` });
      }

      if (rawScore < 0 || rawScore > 100000) {
        return res.status(400).json({ error: 'Invalid score.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      if (user.isBanned) return res.status(403).json({ error: 'Account suspended.' });

      // One submission per day
      const existing = await prisma.miniGameScore.findUnique({
        where: { userId_playedDate: { userId, playedDate: today } },
      });
      if (existing) {
        return res.status(409).json({ error: 'Already submitted today.' });
      }

      // Validate boost: user must have the adScoreBoost flag set
      const boosted = isBoosted && user.adScoreBoost;
      const finalScore = boosted ? rawScore * 2 : rawScore;

      // Atomic: create score record + reset boost flag + track active days
      const activeDayIncrement = user.lastActiveDate !== today ? 1 : 0;

      await prisma.$transaction([
        prisma.miniGameScore.create({
          data: {
            userId,
            gameType,
            score: finalScore,
            rawScore,
            isBoosted: boosted,
            playedDate: today,
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            adScoreBoost: false, // consume the boost
            lastActiveDate: today,
            ...(activeDayIncrement > 0 ? { activeDays: { increment: activeDayIncrement } } : {}),
          },
        }),
      ]);

      // Compute rank for this submission
      const rank = await prisma.miniGameScore.count({
        where: { playedDate: today, gameType, score: { gt: finalScore } },
      });

      return res.json({
        success: true,
        score: finalScore,
        rawScore,
        isBoosted: boosted,
        rank: rank + 1,
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Already submitted today.' });
      }
      console.error('Game submit error:', err);
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

/**
 * GET /api/game/leaderboard
 *
 * Returns top 50 scores for today's game + current user's entry.
 */
router.get('/leaderboard', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const today = getToday();
    const gameType = getTodayGame();

    // Fetch top 50
    const top50 = await prisma.miniGameScore.findMany({
      where: { playedDate: today, gameType },
      orderBy: { score: 'desc' },
      take: 50,
      include: {
        user: { select: { username: true, firstName: true, photoUrl: true } },
      },
    });

    const entries = top50.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId.toString(),
      username: entry.user.username,
      firstName: entry.user.firstName,
      photoUrl: entry.user.photoUrl,
      score: entry.score,
      isBoosted: entry.isBoosted,
      isCurrentUser: entry.userId === userId,
    }));

    // Current user's rank (if not in top 50)
    let currentUserRank: number | null = null;
    let currentUserEntry = entries.find((e) => e.isCurrentUser);

    if (!currentUserEntry) {
      const userScore = await prisma.miniGameScore.findUnique({
        where: { userId_playedDate: { userId, playedDate: today } },
      });
      if (userScore) {
        const rank = await prisma.miniGameScore.count({
          where: { playedDate: today, gameType, score: { gt: userScore.score } },
        });
        currentUserRank = rank + 1;
      }
    } else {
      currentUserRank = currentUserEntry.rank;
    }

    return res.json({ gameType, date: today, entries, currentUserRank });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/game/status
 *
 * Returns whether the current user has submitted today and the current game type.
 */
router.get('/status', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const today = getToday();
    const gameType = getTodayGame();

    const submission = await prisma.miniGameScore.findUnique({
      where: { userId_playedDate: { userId, playedDate: today } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { adScoreBoost: true },
    });

    return res.json({
      gameType,
      date: today,
      submitted: Boolean(submission),
      submission: submission
        ? { score: submission.score, rawScore: submission.rawScore, isBoosted: submission.isBoosted }
        : null,
      adScoreBoost: user?.adScoreBoost ?? false,
    });
  } catch (err) {
    console.error('Game status error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
