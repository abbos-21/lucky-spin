import { useState, useEffect } from 'react';
import { useStore, useToast } from '../store/useStore';
import { api, ApiError, WithdrawInfo, Withdrawal } from '../lib/api';
import { haptic } from '../lib/telegram';

interface Props {
  onBack: () => void;
}

type Stage = 'info' | 'form' | 'confirm' | 'success';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:        { label: 'Queued',      color: 'text-blue-500' },
  PENDING_REVIEW: { label: 'In review',   color: 'text-yellow-500' },
  PROCESSING:     { label: 'Processing',  color: 'text-purple-500' },
  CONFIRMED:      { label: 'Confirmed',   color: 'text-green-600' },
  FAILED:         { label: 'Failed',      color: 'text-red-500' },
  REJECTED:       { label: 'Rejected',    color: 'text-red-500' },
};

export default function WithdrawPage({ onBack }: Props) {
  const { user, setUser } = useStore();
  const toast = useToast();

  const [info, setInfo] = useState<WithdrawInfo | null>(null);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>('info');

  // Form state
  const [address, setAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ id: string; amountTon: number; fee: number; status: string } | null>(null);

  useEffect(() => {
    Promise.all([api.withdraw.info(), api.withdraw.history()])
      .then(([infoData, histData]) => {
        setInfo(infoData);
        setHistory(histData.withdrawals);
        // Pre-fill saved address
        if (infoData.savedAddress) setAddress(infoData.savedAddress);
      })
      .catch(() => toast.error('Could not load withdrawal info.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!info || submitting) return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount < info.config.minTon) {
      toast.error(`Minimum withdrawal is ${info.config.minTon} TON`);
      return;
    }
    if (amount > info.config.maxTon) {
      toast.error(`Maximum withdrawal is ${info.config.maxTon} TON`);
      return;
    }
    if (amount > info.tonBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (!/^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(address.trim())) {
      toast.error('Invalid TON address. Must start with UQ or EQ.');
      return;
    }

    setStage('confirm');
  }

  async function handleConfirm() {
    if (!info || submitting) return;
    setSubmitting(true);
    haptic.medium();

    try {
      const result = await api.withdraw.submit(address.trim(), parseFloat(amountInput));
      setLastResult(result.withdrawal as any);
      if (user) {
        setUser({ ...user, tonBalance: result.newBalance });
      }
      haptic.success();
      setStage('success');
      // Refresh history
      api.withdraw.history().then((d) => setHistory(d.withdrawals)).catch(() => {});
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Withdrawal failed. Try again.';
      toast.error(msg);
      haptic.error();
      setStage('form');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5">
        <div className="h-28 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  const amount = parseFloat(amountInput) || 0;
  const netAmount = Math.max(0, amount - (info?.config.fee ?? 0));
  const eligible = info?.eligibility.canWithdraw ?? false;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 text-sm active:scale-95 transition-transform"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">💸 Withdraw TON</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-5">

        {/* ── Balance card ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Available balance</p>
          <p className="text-4xl font-black mt-1">{(info?.tonBalance ?? 0).toFixed(4)} TON</p>
          <p className="text-xs opacity-70 mt-1">
            Total withdrawn: {(info?.tonWithdrawn ?? 0).toFixed(4)} TON
          </p>
        </div>

        {/* ── Eligibility checklist ──────────────────────────────────────── */}
        {info && !eligible && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Complete these to unlock withdrawals:
            </p>
            <EligibilityRow
              done={info.eligibility.activeDays >= info.eligibility.activeDaysRequired}
              label={`${info.eligibility.activeDays}/${info.eligibility.activeDaysRequired} active days`}
            />
            <EligibilityRow
              done={info.eligibility.totalSpins >= info.eligibility.spinsRequired}
              label={`${info.eligibility.totalSpins}/${info.eligibility.spinsRequired} spins`}
            />
            <EligibilityRow
              done={info.eligibility.gameSubmissions >= info.eligibility.gamesRequired}
              label={`${info.eligibility.gameSubmissions}/${info.eligibility.gamesRequired} game submissions`}
            />
            <EligibilityRow
              done={(info.tonBalance) >= info.config.minTon}
              label={`Min ${info.config.minTon} TON balance`}
            />
          </div>
        )}

        {/* ── Withdrawal form (only when eligible and not in confirm/success) ── */}
        {eligible && (stage === 'info' || stage === 'form') && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New Withdrawal</h2>

            {/* Address input */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">TON Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="UQ... or EQ..."
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors font-mono"
              />
              <p className="text-xs text-gray-400">Paste your Tonkeeper or TON Wallet address</p>
            </div>

            {/* Amount input */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Amount (TON) · max {info!.config.maxTon}
              </label>
              <input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder={`${info!.config.minTon}`}
                min={info!.config.minTon}
                max={Math.min(info!.config.maxTon, info!.tonBalance)}
                step="0.01"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
              />
              {/* Quick-select percentage buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {[25, 50, 75, 100].map((pct) => {
                  const maxAvail = Math.min(info!.config.maxTon, info!.tonBalance);
                  const val = Math.max(0, (maxAvail * pct) / 100);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAmountInput(val.toFixed(4))}
                      className="py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fee breakdown */}
            {amount > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Amount</span>
                  <span>{amount.toFixed(4)} TON</span>
                </div>
                <div className="flex justify-between text-gray-500 dark:text-gray-400 text-xs">
                  <span>Network fee</span>
                  <span>−{info!.config.fee} TON</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-1.5 flex justify-between font-bold text-gray-900 dark:text-white">
                  <span>You receive</span>
                  <span>{netAmount.toFixed(4)} TON</span>
                </div>
              </div>
            )}

            {/* Trust score note */}
            {info!.trustScore < 60 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
                ⏳ Your account is in soft-review mode. Withdrawal will be processed within 24h.
              </p>
            )}

            <button
              className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-bold text-sm active:scale-[0.98] transition-transform shadow-md disabled:opacity-50"
              disabled={!amountInput || amount < info!.config.minTon || !address.trim()}
              onClick={handleSubmit}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Confirm stage ─────────────────────────────────────────────── */}
        {stage === 'confirm' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white text-center">
              Confirm Withdrawal
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">To</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold">{parseFloat(amountInput).toFixed(4)} TON</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Network fee</span>
                <span>−{info?.config.fee} TON</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-700 pt-2">
                <span>You receive</span>
                <span>{netAmount.toFixed(4)} TON</span>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm active:scale-95 transition-transform"
                onClick={() => setStage('form')}
                disabled={submitting}
              >
                Back
              </button>
              <button
                className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-60 shadow-md"
                disabled={submitting}
                onClick={handleConfirm}
              >
                {submitting ? 'Sending…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* ── Success stage ─────────────────────────────────────────────── */}
        {stage === 'success' && lastResult && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-center space-y-3">
            <p className="text-4xl">✅</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Withdrawal submitted!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lastResult.amountTon.toFixed(4)} TON is{' '}
              {lastResult.status === 'PENDING' ? 'being processed automatically.' : 'queued for manual review.'}
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-left space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <p>ID: <span className="font-mono">{lastResult.id.slice(0, 16)}…</span></p>
              <p>Status: <span className={STATUS_LABELS[lastResult.status]?.color}>{STATUS_LABELS[lastResult.status]?.label}</span></p>
            </div>
            <button
              className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm active:scale-95 transition-transform"
              onClick={() => setStage('info')}
            >
              Done
            </button>
          </div>
        )}

        {/* ── Transaction history ───────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-1">
              History
            </h2>
            {history.map((w) => {
              const s = STATUS_LABELS[w.status] ?? { label: w.status, color: 'text-gray-500' };
              return (
                <div
                  key={w.id}
                  className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-700"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {w.amountTon.toFixed(4)} TON
                    </p>
                    <p className="text-xs text-gray-400 truncate font-mono">
                      {w.tonAddress.slice(0, 12)}…
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-xs font-semibold ${s.color}`}>{s.label}</p>
                    {w.txHash && (
                      <a
                        href={`https://testnet.tonscan.org/tx/${w.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 font-mono mt-0.5 hover:underline block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {w.txHash.slice(0, 8)}… ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {history.length === 0 && eligible && stage === 'info' && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
            No withdrawals yet.
          </p>
        )}
      </div>
    </div>
  );
}

function EligibilityRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={done ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}>
        {done ? '✅' : '○'}
      </span>
      <span className={done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
        {label}
      </span>
    </div>
  );
}
