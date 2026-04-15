import { useState, useEffect, useCallback } from 'react';
import { useStore, useToast } from '../store/useStore';
import { api, ApiError, EarnTasksResult } from '../lib/api';
import { haptic } from '../lib/telegram';
import AdButton from '../components/AdButton';

// Formats seconds remaining as "Xh Ym" or "Xm"
function formatCountdown(endsAt: string): string {
  const msLeft = new Date(endsAt).getTime() - Date.now();
  if (msLeft <= 0) return '';
  const totalSecs = Math.ceil(msLeft / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.ceil((totalSecs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Live countdown component — ticks every 30s
function Countdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState(() => formatCountdown(endsAt));

  useEffect(() => {
    const tick = () => setLabel(formatCountdown(endsAt));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!label) return null;
  return <span className="text-xs text-orange-500 font-medium">({label})</span>;
}

export default function EarnPage() {
  const { user, updateBalance } = useStore();
  const toast = useToast();

  const [tasks, setTasks] = useState<EarnTasksResult['tasks'] | null>(null);
  const [todayPoints, setTodayPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingTask, setClaimingTask] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.earn.tasks();
      setTasks(data.tasks);
      setTodayPoints(data.todayPoints);
      setTotalPoints(data.totalPointsEarned);
    } catch {
      // Non-critical — keep showing stale data if any
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function handleAdSuccess(_adType: string, pts: number) {
    updateBalance(pts);
    // Refresh tasks to get updated cooldown state
    loadTasks();
  }

  async function handleSocialTask(taskId: string) {
    if (claimingTask) return;
    setClaimingTask(taskId);
    haptic.medium();
    try {
      const res = await api.earn.socialTask(taskId);
      if (res.success) {
        toast.success(`+${res.coinsAwarded} coins earned!`);
        haptic.success();
        loadTasks();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.info(err.message);
      } else {
        toast.error('Could not claim reward. Try again.');
      }
      haptic.error();
    } finally {
      setClaimingTask(null);
    }
  }

  async function handleCopyReferral(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      haptic.success();
      toast.success('Link copied!');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      toast.error('Could not copy link.');
    }
  }

  function handleShareReferral(link: string) {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join Lucky Spin and earn coins!')}`);
    } else {
      handleCopyReferral(link);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5">
        {/* Points header skeleton */}
        <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        {/* Task card skeletons */}
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const adTasks = tasks?.adTasks ?? [];
  const spinInfo = tasks?.spinInfo;
  const boostInfo = tasks?.scoreBoostInfo;
  const socialTasks = tasks?.socialTasks ?? [];

  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6 gap-5">

      {/* Points header */}
      <div className="w-full max-w-sm mx-auto bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Lifetime earned</p>
        <p className="text-3xl font-black mt-0.5">{totalPoints.toLocaleString()} pts</p>
        <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
          <span className="text-xs opacity-80">Today</span>
          <span className="text-sm font-bold">+{todayPoints.toLocaleString()} pts</span>
        </div>
      </div>

      {/* ── Ad tasks ─────────────────────────────────────────────────────── */}
      <section className="w-full max-w-sm mx-auto space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-1">
          Ad Tasks
        </h2>

        {adTasks.map((task) => {
          const onCooldown = Boolean(task.cooldownEndsAt);
          const exhausted = task.exhausted;

          return (
            <div
              key={task.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                  {task.label}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-orange-500 font-medium">+{task.points} pts</p>
                  {onCooldown && task.cooldownEndsAt && (
                    <Countdown endsAt={task.cooldownEndsAt} />
                  )}
                  {exhausted && (
                    <span className="text-xs text-gray-400">✅ done today</span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <AdButton
                  adType={task.adType as 'earn_coins' | 'earn_ticket'}
                  label="Watch"
                  onSuccess={(pts) => handleAdSuccess(task.adType, pts)}
                  disabled={onCooldown || exhausted}
                  cooldownText={onCooldown && task.cooldownEndsAt ? formatCountdown(task.cooldownEndsAt) : undefined}
                  className="px-4 py-2 text-xs"
                />
              </div>
            </div>
          );
        })}

        {/* Spin ad info */}
        {spinInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                Watch ad → Extra spin
              </p>
              <p className="text-xs text-orange-500 font-medium mt-0.5">
                +{spinInfo.pointsPerSpin} pts · {spinInfo.adSpinsUsed}/{spinInfo.adSpinsMax} used today
              </p>
            </div>
            <div className="shrink-0">
              <div className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs text-gray-400 font-medium text-center">
                On Spin tab
              </div>
            </div>
          </div>
        )}

        {/* Score boost info */}
        {boostInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                Watch ad → 2× game score
              </p>
              <p className="text-xs text-orange-500 font-medium mt-0.5">
                +{boostInfo.pointsForViewing} pts · {boostInfo.used ? '✅ Used today' : 'Available'}
              </p>
            </div>
            <div className="shrink-0">
              <div className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-700 text-xs text-gray-400 font-medium text-center">
                On Game tab
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Social tasks ──────────────────────────────────────────────────── */}
      <section className="w-full max-w-sm mx-auto space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-1">
          Social Tasks
        </h2>

        {socialTasks.map((task) => {
          if (task.id === 'join_channel') {
            return (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-3.5 flex items-center gap-3 shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                    📢 {task.label}
                  </p>
                  <p className="text-xs text-orange-500 font-medium mt-0.5">
                    +{task.rewardCoins} coins · One-time
                  </p>
                </div>
                <div className="shrink-0">
                  {task.completed ? (
                    <div className="px-4 py-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-xs text-green-600 dark:text-green-400 font-semibold">
                      ✅ Done
                    </div>
                  ) : (
                    <button
                      className="px-4 py-2 rounded-xl bg-blue-500 text-white text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50"
                      disabled={claimingTask === task.id}
                      onClick={async () => {
                        // Open channel first, then claim
                        if (task.url) {
                          const tg = (window as any).Telegram?.WebApp;
                          if (tg?.openTelegramLink) tg.openTelegramLink(task.url);
                          else window.open(task.url, '_blank');
                        }
                        // Small delay so user has time to see it open
                        setTimeout(() => handleSocialTask(task.id), 1500);
                      }}
                    >
                      {claimingTask === task.id ? '…' : 'Join & Claim'}
                    </button>
                  )}
                </div>
              </div>
            );
          }

          if (task.id === 'invite_friend') {
            return (
              <div
                key={task.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                      👥 {task.label}
                    </p>
                    <p className="text-xs text-orange-500 font-medium mt-0.5">
                      {task.reward} · Credited when friend spins
                    </p>
                  </div>
                </div>

                {task.referralLink && (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                      {task.referralLink}
                    </div>
                    <button
                      className="shrink-0 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 active:scale-95 transition-transform"
                      onClick={() => handleCopyReferral(task.referralLink!)}
                    >
                      {copiedLink ? '✅' : '📋'}
                    </button>
                    <button
                      className="shrink-0 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold active:scale-95 transition-transform"
                      onClick={() => handleShareReferral(task.referralLink!)}
                    >
                      Share
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </section>

      {/* Coins balance footer */}
      <div className="w-full max-w-sm mx-auto text-center text-sm text-gray-400 dark:text-gray-500">
        🪙 {(user?.coins ?? 0).toLocaleString()} coins balance
      </div>
    </div>
  );
}
