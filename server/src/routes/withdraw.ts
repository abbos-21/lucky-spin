import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { validateTelegramAuth } from '../middleware/auth';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { CONFIG } from '../config/constants';
import { validateTonAddress, getHotWalletBalance } from '../services/tonWallet';
import { updateTrustScore } from '../services/trustScore';

const router = Router();

/**
 * POST /api/withdraw
 *
 * Submits a withdrawal request. Performs all eligibility checks, deducts the
 * balance atomically, and queues it for the background processor.
 */
router.post('/', rateLimitPerUser(5, 60_000), validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const { tonAddress, amountTon: rawAmount } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    const amountTon = parseFloat(rawAmount);
    if (isNaN(amountTon) || amountTon <= 0) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    const addrCheck = validateTonAddress(tonAddress?.trim() ?? '');
    if (!addrCheck.valid) {
      return res.status(400).json({ error: addrCheck.error });
    }

    // ── Fetch user ────────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended.' });

    // ── Eligibility checks ────────────────────────────────────────────────────
    if (user.activeDays < CONFIG.MIN_ACTIVE_DAYS) {
      return res.status(403).json({
        error: `Play for at least ${CONFIG.MIN_ACTIVE_DAYS} active days to unlock withdrawals.`,
        required: CONFIG.MIN_ACTIVE_DAYS,
        current: user.activeDays,
      });
    }

    const [spins, games] = await Promise.all([
      prisma.spinLog.count({ where: { userId } }),
      prisma.miniGameScore.count({ where: { userId } }),
    ]);

    if (spins < CONFIG.MIN_TOTAL_SPINS) {
      return res.status(403).json({
        error: `Complete at least ${CONFIG.MIN_TOTAL_SPINS} spins first.`,
        required: CONFIG.MIN_TOTAL_SPINS,
        current: spins,
      });
    }

    if (games < CONFIG.MIN_GAME_SUBMISSIONS) {
      return res.status(403).json({
        error: `Submit at least ${CONFIG.MIN_GAME_SUBMISSIONS} mini-game scores first.`,
        required: CONFIG.MIN_GAME_SUBMISSIONS,
        current: games,
      });
    }

    // ── Amount checks ─────────────────────────────────────────────────────────
    if (amountTon < CONFIG.MIN_WITHDRAWAL_TON) {
      return res.status(400).json({ error: `Minimum withdrawal is ${CONFIG.MIN_WITHDRAWAL_TON} TON.` });
    }

    const maxAllowed =
      user.trustScore >= CONFIG.TRUST_AUTO_APPROVE
        ? CONFIG.MAX_WITHDRAWAL_TON
        : CONFIG.MIN_WITHDRAWAL_TON * 3;

    if (amountTon > maxAllowed) {
      return res.status(400).json({ error: `Maximum withdrawal is ${maxAllowed} TON for your account level.` });
    }

    if (user.tonBalance < amountTon) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    // ── Cooldown check ────────────────────────────────────────────────────────
    if (user.lastWithdrawAt) {
      const hoursSince = (Date.now() - new Date(user.lastWithdrawAt).getTime()) / 3_600_000;
      if (hoursSince < CONFIG.WITHDRAWAL_COOLDOWN_HOURS) {
        const hoursLeft = Math.ceil(CONFIG.WITHDRAWAL_COOLDOWN_HOURS - hoursSince);
        return res.status(429).json({
          error: `Please wait ${hoursLeft} more hour${hoursLeft !== 1 ? 's' : ''} before next withdrawal.`,
        });
      }
    }

    // ── Weekly limit check ────────────────────────────────────────────────────
    const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
    const weekCount = await prisma.withdrawal.count({
      where: { userId, createdAt: { gte: weekAgo }, status: { not: 'REJECTED' } },
    });
    if (weekCount >= CONFIG.MAX_WITHDRAWALS_PER_WEEK) {
      return res.status(429).json({ error: `Maximum ${CONFIG.MAX_WITHDRAWALS_PER_WEEK} withdrawals per week.` });
    }

    // ── Hot wallet reserve check ──────────────────────────────────────────────
    const hotBalance = await getHotWalletBalance();
    if (hotBalance - amountTon < CONFIG.HOT_WALLET_MIN_RESERVE_TON) {
      return res.status(503).json({ error: 'Withdrawals temporarily unavailable. Try again later.' });
    }

    // ── Refresh trust score before routing ───────────────────────────────────
    const freshScore = await updateTrustScore(userId);
    const status = freshScore >= CONFIG.TRUST_AUTO_APPROVE ? 'PENDING' : 'PENDING_REVIEW';
    const netAmount = amountTon - CONFIG.NETWORK_FEE_TON;

    // ── Atomic: deduct balance + create withdrawal record ─────────────────────
    const [updatedUser, withdrawal] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          tonBalance: { decrement: amountTon },
          tonAddress: tonAddress.trim(),
          lastWithdrawAt: new Date().toISOString(),
        },
      }),
      prisma.withdrawal.create({
        data: {
          userId,
          tonAddress: tonAddress.trim(),
          amountTon: netAmount,
          fee: CONFIG.NETWORK_FEE_TON,
          status,
          trustScoreAt: freshScore,
        },
      }),
    ]);

    return res.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amountTon: netAmount,
        fee: CONFIG.NETWORK_FEE_TON,
        status,
      },
      newBalance: updatedUser.tonBalance,
    });
  } catch (err) {
    console.error('[Withdraw] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/withdraw/history
 *
 * Returns the user's last 20 withdrawal records.
 */
router.get('/history', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ withdrawals });
  } catch (err) {
    console.error('[Withdraw] History error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/withdraw/info
 *
 * Returns eligibility status and config for the WithdrawPage.
 */
router.get('/info', validateTelegramAuth, async (req, res) => {
  try {
    const userId = BigInt(req.telegramUserId!);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Not found' });

    const [spins, games] = await Promise.all([
      prisma.spinLog.count({ where: { userId } }),
      prisma.miniGameScore.count({ where: { userId } }),
    ]);

    const maxTon =
      user.trustScore >= CONFIG.TRUST_AUTO_APPROVE
        ? CONFIG.MAX_WITHDRAWAL_TON
        : CONFIG.MIN_WITHDRAWAL_TON * 3;

    return res.json({
      tonBalance: user.tonBalance,
      pointsBalance: user.pointsBalance,
      tonWithdrawn: user.tonWithdrawn,
      savedAddress: user.tonAddress,
      trustScore: user.trustScore,
      eligibility: {
        canWithdraw:
          !user.isBanned &&
          user.activeDays >= CONFIG.MIN_ACTIVE_DAYS &&
          spins >= CONFIG.MIN_TOTAL_SPINS &&
          games >= CONFIG.MIN_GAME_SUBMISSIONS &&
          user.tonBalance >= CONFIG.MIN_WITHDRAWAL_TON,
        activeDays: user.activeDays,
        activeDaysRequired: CONFIG.MIN_ACTIVE_DAYS,
        totalSpins: spins,
        spinsRequired: CONFIG.MIN_TOTAL_SPINS,
        gameSubmissions: games,
        gamesRequired: CONFIG.MIN_GAME_SUBMISSIONS,
      },
      config: {
        minTon: CONFIG.MIN_WITHDRAWAL_TON,
        maxTon,
        fee: CONFIG.NETWORK_FEE_TON,
        cooldownHours: CONFIG.WITHDRAWAL_COOLDOWN_HOURS,
      },
    });
  } catch (err) {
    console.error('[Withdraw] Info error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
