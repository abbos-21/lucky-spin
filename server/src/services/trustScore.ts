import { prisma } from '../lib/prisma';

/**
 * Recalculate a user's trust score based on behavioral signals.
 *
 * Called after key actions: game submission, daily login, withdrawal request.
 * Score range: 0–100, starting at 50.
 *
 * Gates:
 *   ≥ 60  → automatic withdrawal processing (PENDING)
 *   40–59 → soft review delay (PENDING_REVIEW)
 *   < 40  → withdrawals frozen (admin review required)
 */
export async function updateTrustScore(userId: bigint): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 0;

  let score = 50; // baseline

  // ── Positive signals: engagement depth ───────────────────────────────────────
  if (user.streak >= 7)  score += 5;
  if (user.streak >= 14) score += 5;  // stacks with the above
  if (user.activeDays >= 30) score += 10;
  if (user.activeDays >= 60) score +=  5;

  // Game variety: rewards users who explore different games
  const gameTypes = await prisma.miniGameScore.findMany({
    where: { userId },
    distinct: ['gameType'],
    select: { gameType: true },
  });
  if (gameTypes.length >= 3) score += 5;
  if (gameTypes.length >= 5) score += 3;

  // Score variance: natural human scores vary; bots often submit identical scores
  const recentScores = await prisma.miniGameScore.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
    take: 10,
    select: { rawScore: true },
  });
  if (recentScores.length >= 5) {
    const vals = recentScores.map((s) => s.rawScore);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / vals.length;
    if (variance < 1) score -= 15;       // suspiciously identical scores
    else if (variance > 10) score += 3;  // natural human variance
  }

  // ── Negative signals: bot-like patterns ──────────────────────────────────────

  // Ad timing uniformity: bots click ads at machine-precise intervals
  const recentAds = await prisma.adView.findMany({
    where: { userId },
    orderBy: { viewedAt: 'desc' },
    take: 20,
    select: { viewedAt: true },
  });
  if (recentAds.length >= 10) {
    const intervals: number[] = [];
    for (let i = 0; i < recentAds.length - 1; i++) {
      intervals.push(recentAds[i].viewedAt.getTime() - recentAds[i + 1].viewedAt.getTime());
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariance =
      intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length;
    if (intervalVariance < 1_000) score -= 20; // near-perfectly spaced = bot
  }

  // ── Social signals: referrals add trust ──────────────────────────────────────
  const activeReferrals = await prisma.referral.count({
    where: { referrerId: userId, bonusAwarded: true },
  });
  score += Math.min(activeReferrals * 2, 10); // cap at +10

  // ── Device sharing: multiple accounts on the same device ─────────────────────
  if (user.deviceFingerprint) {
    const sharedAccounts = await prisma.user.count({
      where: {
        deviceFingerprint: user.deviceFingerprint,
        id: { not: userId },
      },
    });
    if (sharedAccounts >= 2) score -= 20;
    if (sharedAccounts >= 5) score -= 30;
  }

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score));

  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: score },
  });

  return score;
}
