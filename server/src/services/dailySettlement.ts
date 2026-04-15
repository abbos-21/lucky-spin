import { prisma } from '../lib/prisma';
import { CONFIG } from '../config/constants';

export async function runDailySettlement(
  date: string,
  totalRevenue: number,
  tonPriceUsd: number
): Promise<{ usersSettled: number; totalTonPaid: number }> {
  const userShareUsd = totalRevenue * CONFIG.USER_SHARE;

  const unsettledViews = await prisma.adView.findMany({
    where: { settled: false, viewedAt: { lt: new Date(date + 'T23:59:59Z') } },
  });

  const totalPoints = unsettledViews.reduce((sum, v) => sum + v.pointsAwarded, 0);
  if (totalPoints === 0) return { usersSettled: 0, totalTonPaid: 0 };

  const pointValueUsd = userShareUsd / totalPoints;
  const pointValueTon = pointValueUsd / tonPriceUsd;

  const userPoints: Record<string, number> = {};
  for (const view of unsettledViews) {
    const key = view.userId.toString();
    userPoints[key] = (userPoints[key] || 0) + view.pointsAwarded;
  }

  let usersSettled = 0;
  let totalTonPaid = 0;

  for (const [userIdStr, points] of Object.entries(userPoints)) {
    const userId = BigInt(userIdStr);
    const tonEarned = points * pointValueTon;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tonBalance: { increment: tonEarned }, pointsBalance: { decrement: points } },
      }),
      prisma.adView.updateMany({
        where: { userId, settled: false, viewedAt: { lt: new Date(date + 'T23:59:59Z') } },
        data: { settled: true, settlementDate: date },
      }),
    ]);

    usersSettled++;
    totalTonPaid += tonEarned;
  }

  await prisma.dailySettlement.create({
    data: { date, totalRevenue, userShareUsd, totalPoints, pointValueUsd, tonPriceUsd, pointValueTon, usersSettled, totalTonPaid },
  });

  return { usersSettled, totalTonPaid };
}
