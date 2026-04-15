import { useState } from 'react';
import { useStore, useToast } from '../store/useStore';
import { api, ApiError } from '../lib/api';
import { haptic } from '../lib/telegram';
import { CONFIG } from '../config/constants';
import SpinWheel from '../components/SpinWheel';
import StreakBar from '../components/StreakBar';
import AdButton from '../components/AdButton';
import AnimatedNumber from '../components/AnimatedNumber';

type SpinState = 'idle' | 'spinning' | 'result';

interface SpinResult {
  segmentIndex: number;
  reward: { type: string; value: string; label: string };
  streak: { current: number; longest: number; shieldConsumed: boolean };
  user: { coins?: number; streak?: number; adSpinsToday?: number; lastSpinDate?: string };
}

export default function SpinPage() {
  const { user, setUser, updateBalance } = useStore();
  const toast = useToast();

  const [spinState, setSpinState] = useState<SpinState>('idle');
  const [targetSegment, setTargetSegment] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  // Track ad-spin unlocked locally so button disappears immediately after use
  const [adSpinUnlocked, setAdSpinUnlocked] = useState(false);

  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  const hasFreeSpin = user.lastSpinDate !== today;
  const adSpinsToday = user.adSpinsToday ?? 0;
  const canAdSpin = adSpinsToday < CONFIG.MAX_AD_SPINS_PER_DAY;

  async function doSpin(isAdSpin: boolean) {
    if (spinState !== 'idle' || !user) return;
    const currentUser = user;

    try {
      setSpinState('spinning');
      setShowResult(false);
      haptic.medium();

      const result = await api.spin.spin(isAdSpin);
      const typedResult = result as SpinResult;

      setTargetSegment(typedResult.segmentIndex);
      setLastResult(typedResult);

      // Merge updated fields back into store
      setUser({
        ...currentUser,
        coins: typedResult.user.coins ?? currentUser.coins,
        streak: typedResult.user.streak ?? currentUser.streak,
        longestStreak: typedResult.streak.longest ?? currentUser.longestStreak,
        adSpinsToday: typedResult.user.adSpinsToday ?? currentUser.adSpinsToday,
        lastSpinDate: typedResult.user.lastSpinDate ?? currentUser.lastSpinDate,
        ...(typedResult.streak.shieldConsumed ? { streakShield: false } : {}),
      });

      if (isAdSpin) setAdSpinUnlocked(false);
    } catch (err) {
      setSpinState('idle');
      haptic.error();
      toast.error(err instanceof ApiError ? err.message : 'Spin failed. Try again.');
    }
  }

  function handleSpinEnd() {
    setSpinState('result');
    setShowResult(true);
    const seg = lastResult?.reward;
    if (seg?.type === 'jackpot') haptic.heavy();
    else haptic.success();
  }

  function handleCollect() {
    setSpinState('idle');
    setShowResult(false);
    setLastResult(null);
  }

  // Called by AdButton after a successful rewarded_spin ad
  function handleAdSpinReward(pointsAwarded: number) {
    updateBalance(pointsAwarded);
    setAdSpinUnlocked(true);
  }

  const showAdSpinButton = canAdSpin && !adSpinUnlocked && spinState === 'idle' && !hasFreeSpin;
  const showAdSpinAfterResult = canAdSpin && !adSpinUnlocked && spinState === 'result';

  return (
    <div className="flex flex-col items-center min-h-full px-4 pt-6 pb-4 gap-5">
      {/* Streak bar */}
      <div className="w-full max-w-sm">
        <StreakBar
          streak={user.streak}
          longestStreak={user.longestStreak}
          streakShield={user.streakShield}
        />
      </div>

      {/* Wheel */}
      <SpinWheel
        spinning={spinState === 'spinning'}
        targetSegment={targetSegment}
        onSpinEnd={handleSpinEnd}
      />

      {/* Result card */}
      {showResult && lastResult && (
        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border border-gray-100 dark:border-gray-700 animate-bounce-in">
          <div className="text-center space-y-1">
            <p className="text-3xl">{rewardEmoji(lastResult.reward.type)}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{lastResult.reward.label}</p>
            {lastResult.streak.shieldConsumed && (
              <p className="text-xs text-blue-500">🛡 Streak shield used</p>
            )}
            {lastResult.streak.current > 1 && !lastResult.streak.shieldConsumed && (
              <p className="text-xs text-orange-500">🔥 {lastResult.streak.current} day streak!</p>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="w-full max-w-sm space-y-3">
        {spinState === 'result' ? (
          <>
            {/* Ad button for extra spin — secondary, smaller */}
            {showAdSpinAfterResult && (
              <AdButton
                adType="rewarded_spin"
                label={`Watch ad → Spin again (${CONFIG.MAX_AD_SPINS_PER_DAY - adSpinsToday} left)`}
                onSuccess={handleAdSpinReward}
                className="w-full py-3"
              />
            )}

            {/* If ad-spin just unlocked — spin button */}
            {adSpinUnlocked && (
              <button
                className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg"
                onClick={() => doSpin(true)}
              >
                🎬 Use your ad spin!
              </button>
            )}

            {/* Primary: collect — always larger and more prominent */}
            <button
              className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg"
              onClick={handleCollect}
            >
              ✅ Collect
            </button>
          </>
        ) : (
          <>
            {/* Free spin */}
            {hasFreeSpin ? (
              <button
                className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg disabled:opacity-50"
                disabled={spinState === 'spinning'}
                onClick={() => doSpin(false)}
              >
                {spinState === 'spinning' ? '🎰 Spinning…' : '🎰 Free Spin!'}
              </button>
            ) : (
              <div className="w-full py-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-center">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">✅ Free spin used today</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Come back tomorrow!</p>
              </div>
            )}

            {/* Ad spin unlock button — only shown when idle and free spin used */}
            {showAdSpinButton && (
              <AdButton
                adType="rewarded_spin"
                label={`Watch ad → Spin again (${CONFIG.MAX_AD_SPINS_PER_DAY - adSpinsToday} left)`}
                onSuccess={handleAdSpinReward}
                className="w-full py-3"
              />
            )}

            {/* Ad spin button after unlock */}
            {adSpinUnlocked && spinState === 'idle' && (
              <button
                className="w-full py-3.5 rounded-xl bg-purple-500 text-white font-bold text-base active:scale-[0.98] transition-transform shadow-lg"
                onClick={() => doSpin(true)}
              >
                🎬 Use your ad spin!
              </button>
            )}
          </>
        )}

        {/* Balance footer */}
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span>🪙 <AnimatedNumber value={user.coins} /></span>
          <span>·</span>
          <span>🔥 {user.streak}-day streak</span>
        </div>
      </div>
    </div>
  );
}

function rewardEmoji(type: string): string {
  return { coins: '🪙', ticket: '🎫', collectible: '🎁', jackpot: '🌟' }[type] ?? '🎁';
}
