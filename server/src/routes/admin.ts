import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { runDailySettlement } from '../services/dailySettlement';
import { getHotWalletBalance } from '../services/tonWallet';

const router = Router();

function adminAuth(req: any, res: any, next: any) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.use(adminAuth);

router.get('/dashboard', async (_req, res) => {
  const [totalUsers, totalAdViews, totalWithdrawals, pendingWithdrawals, totalTonPaidAgg, recentSettlements] = await Promise.all([
    prisma.user.count(),
    prisma.adView.count(),
    prisma.withdrawal.count({ where: { status: 'CONFIRMED' } }),
    prisma.withdrawal.count({ where: { status: { in: ['PENDING', 'PENDING_REVIEW'] } } }),
    prisma.withdrawal.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amountTon: true } }),
    prisma.dailySettlement.findMany({ orderBy: { date: 'desc' }, take: 7 }),
  ]);
  const activeToday = await prisma.user.count({ where: { lastActiveDate: new Date().toISOString().split('T')[0] } });

  const hotWalletBalance = await getHotWalletBalance();
  return res.json({ totalUsers, activeToday, totalAdViews, totalWithdrawals, pendingWithdrawals, totalTonPaid: totalTonPaidAgg._sum.amountTon || 0, hotWalletBalance, recentSettlements });
});

router.post('/settlement', async (req, res) => {
  const { date, totalRevenue, tonPriceUsd } = req.body;
  if (!date || !totalRevenue || !tonPriceUsd) return res.status(400).json({ error: 'date, totalRevenue, tonPriceUsd required' });

  const existing = await prisma.dailySettlement.findUnique({ where: { date } });
  if (existing) return res.status(400).json({ error: 'Already settled for this date' });

  const result = await runDailySettlement(date, parseFloat(totalRevenue), parseFloat(tonPriceUsd));
  await prisma.adminLog.create({ data: { action: 'settlement', details: JSON.stringify({ date, totalRevenue, ...result }), adminId: 'owner' } });

  return res.json({ success: true, ...result });
});

router.get('/withdrawals', async (req, res) => {
  const status = (req.query.status as string) || 'PENDING_REVIEW';
  const withdrawals = await prisma.withdrawal.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { username: true, trustScore: true, activeDays: true, tonWithdrawn: true } } },
  });
  return res.json({ withdrawals });
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  await prisma.withdrawal.update({ where: { id: req.params.id }, data: { status: 'PENDING', reviewNote: req.body.note || 'Approved by admin' } });
  await prisma.adminLog.create({ data: { action: 'approve_withdrawal', details: JSON.stringify({ id: req.params.id }), adminId: 'owner' } });
  return res.json({ success: true });
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  const w = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
  if (!w) return res.status(404).json({ error: 'Not found' });

  await prisma.$transaction([
    prisma.withdrawal.update({ where: { id: req.params.id }, data: { status: 'REJECTED', reviewNote: req.body.reason || 'Rejected by admin' } }),
    prisma.user.update({ where: { id: w.userId }, data: { tonBalance: { increment: w.amountTon + w.fee } } }),
  ]);
  await prisma.adminLog.create({ data: { action: 'reject_withdrawal', details: JSON.stringify({ id: req.params.id, reason: req.body.reason }), adminId: 'owner' } });
  return res.json({ success: true });
});

router.post('/users/:id/ban', async (req, res) => {
  const userId = BigInt(req.params.id);
  await prisma.user.update({ where: { id: userId }, data: { isBanned: true, banReason: req.body.reason || 'Banned by admin' } });
  await prisma.adminLog.create({ data: { action: 'ban_user', details: JSON.stringify({ userId: req.params.id, reason: req.body.reason }), adminId: 'owner' } });
  return res.json({ success: true });
});

router.post('/users/:id/unban', async (req, res) => {
  const userId = BigInt(req.params.id);
  await prisma.user.update({ where: { id: userId }, data: { isBanned: false, banReason: null } });
  return res.json({ success: true });
});

router.get('/users/search', async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q?.trim()) return res.status(400).json({ error: 'Query required' });

  const byId = q.trim().match(/^\d+$/)
    ? await prisma.user.findUnique({
        where: { id: BigInt(q.trim()) },
        select: { id: true, username: true, firstName: true, trustScore: true, activeDays: true, tonBalance: true, isBanned: true, banReason: true, createdAt: true },
      }).catch(() => null)
    : null;

  const byUsername = await prisma.user.findMany({
    where: { username: { contains: q.trim() } },
    select: { id: true, username: true, firstName: true, trustScore: true, activeDays: true, tonBalance: true, isBanned: true, banReason: true, createdAt: true },
    take: 10,
  });

  const results = byId
    ? [byId, ...byUsername.filter((u) => u.id !== byId.id)]
    : byUsername;

  return res.json({ users: results.map((u) => ({ ...u, id: u.id.toString() })) });
});

router.get('/fraud-flags', async (_req, res) => {
  const suspicious = await prisma.user.findMany({
    where: { trustScore: { lt: 40 } },
    orderBy: { trustScore: 'asc' },
    take: 50,
    select: { id: true, username: true, firstName: true, trustScore: true, activeDays: true, tonBalance: true, isBanned: true },
  });
  return res.json({ users: suspicious.map((u) => ({ ...u, id: u.id.toString() })) });
});

export default router;
