import { prisma } from '../lib/prisma';
import { sendTon } from './tonWallet';

/**
 * Process the oldest PENDING withdrawal (one at a time, FIFO).
 *
 * PENDING_REVIEW withdrawals are skipped — they require manual admin approval first.
 * The processor runs every 30 seconds. It locks one withdrawal at a time by
 * transitioning it to PROCESSING before the async blockchain call, preventing
 * double-sends if the server restarts mid-flight.
 */
export async function processNextWithdrawal(): Promise<void> {
  const pending = await prisma.withdrawal.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  if (!pending) return;

  // Lock it immediately — prevents duplicate sends on concurrent runs
  await prisma.withdrawal.update({
    where: { id: pending.id },
    data: { status: 'PROCESSING', processedAt: new Date().toISOString() },
  });

  try {
    const result = await sendTon(
      pending.tonAddress,
      pending.amountTon,
      `LuckySpin #${pending.id.slice(0, 8)}`
    );

    if (result.success && result.txHash) {
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id: pending.id },
          data: {
            status: 'CONFIRMED',
            txHash: result.txHash,
            confirmedAt: new Date().toISOString(),
          },
        }),
        prisma.user.update({
          where: { id: pending.userId },
          data: { tonWithdrawn: { increment: pending.amountTon } },
        }),
      ]);
      console.log(`[Processor] Withdrawal ${pending.id} confirmed — tx: ${result.txHash}`);
    } else {
      // Blockchain call failed — refund the full amount (net + fee) back to user
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id: pending.id },
          data: { status: 'FAILED', failReason: result.error ?? 'TX failed' },
        }),
        prisma.user.update({
          where: { id: pending.userId },
          data: { tonBalance: { increment: pending.amountTon + pending.fee } },
        }),
      ]);
      console.warn(`[Processor] Withdrawal ${pending.id} failed: ${result.error}`);
    }
  } catch (err: any) {
    // Unexpected error — also refund
    await prisma.$transaction([
      prisma.withdrawal.update({
        where: { id: pending.id },
        data: { status: 'FAILED', failReason: err?.message ?? 'Unexpected error' },
      }),
      prisma.user.update({
        where: { id: pending.userId },
        data: { tonBalance: { increment: pending.amountTon + pending.fee } },
      }),
    ]);
    console.error(`[Processor] Withdrawal ${pending.id} threw:`, err);
  }
}

/**
 * Also recover any withdrawals stuck in PROCESSING state for more than 10 minutes —
 * this handles the case where the server crashed after locking but before resolving.
 */
async function recoverStuckWithdrawals(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const stuck = await prisma.withdrawal.findMany({
    where: {
      status: 'PROCESSING',
      processedAt: { lt: tenMinutesAgo },
    },
  });

  for (const w of stuck) {
    console.warn(`[Processor] Recovering stuck withdrawal ${w.id}`);
    await prisma.$transaction([
      prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: 'FAILED', failReason: 'Server restart during processing — refunded' },
      }),
      prisma.user.update({
        where: { id: w.userId },
        data: { tonBalance: { increment: w.amountTon + w.fee } },
      }),
    ]);
  }
}

/**
 * Start the background withdrawal processor.
 * Processes one PENDING withdrawal every 30 seconds.
 * Recovers stuck PROCESSING entries on startup and every 5 minutes.
 */
export function startWithdrawalProcessor(): void {
  // Recover stuck entries on startup
  recoverStuckWithdrawals().catch((err) =>
    console.error('[Processor] Recovery failed:', err)
  );

  // Process queue every 30 seconds
  setInterval(async () => {
    try {
      await processNextWithdrawal();
    } catch (err) {
      console.error('[Processor] Error:', err);
    }
  }, 30_000);

  // Re-run recovery every 5 minutes for resilience
  setInterval(async () => {
    try {
      await recoverStuckWithdrawals();
    } catch (err) {
      console.error('[Processor] Recovery error:', err);
    }
  }, 5 * 60_000);

  console.log('[Processor] Withdrawal processor started');
}
