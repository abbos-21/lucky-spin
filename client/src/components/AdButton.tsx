import { useState } from 'react';
import { showRewardedAd, isAdAvailable } from '../lib/adsgram';
import { api, ApiError } from '../lib/api';
import { getFingerprintCached, getSessionId } from '../lib/fingerprint';
import { haptic } from '../lib/telegram';
import { useToast } from '../store/useStore';

interface Props {
  /** Adsgram ad type — sent to /api/earn/ad-reward */
  adType: 'rewarded_spin' | 'rewarded_score' | 'earn_coins' | 'earn_ticket';
  /** Label shown on the button */
  label: string;
  /** Called with the pointsAwarded value after successful reward */
  onSuccess: (pointsAwarded: number) => void;
  /** Optional: disable the button (e.g. cooldown active) */
  disabled?: boolean;
  /** Optional: show a countdown string next to the icon */
  cooldownText?: string;
  /** Optional: className overrides */
  className?: string;
}

type ButtonState = 'idle' | 'loading' | 'done';

/**
 * Adsgram-compliant rewarded ad button.
 *
 * Rules enforced here:
 * 1. Renders nothing when the Adsgram SDK is not available (no broken state).
 * 2. Only calls POST /api/earn/ad-reward after result.done === true.
 * 3. Never shows error state to the user — silently fails.
 * 4. Points are never credited client-side.
 */
export default function AdButton({
  adType,
  label,
  onSuccess,
  disabled = false,
  cooldownText,
  className = '',
}: Props) {
  const [state, setState] = useState<ButtonState>('idle');
  const toast = useToast();

  // ── Adsgram compliance rule #1: hide entirely if SDK not ready ────────────
  if (!isAdAvailable()) return null;

  async function handleClick() {
    if (state !== 'idle' || disabled) return;

    setState('loading');
    haptic.light();

    try {
      // Step 1 — Show the ad via Adsgram SDK
      const result = await showRewardedAd();

      // ── Compliance rule #2: only proceed if user watched the full ad ────
      if (!result.done) {
        // User skipped or ad failed — do nothing, no error shown
        setState('idle');
        return;
      }

      // Step 2 — Call backend to credit points (the ONLY place points are created)
      const [fingerprint] = await Promise.all([getFingerprintCached()]);
      const sessionId = getSessionId();

      const reward = await api.earn.adReward(adType, sessionId, fingerprint);

      haptic.success();
      toast.success(`+${reward.pointsAwarded} points earned!`);
      setState('done');
      onSuccess(reward.pointsAwarded);

      // Reset to idle after a short moment so the button can be used again
      // (rate limits are enforced server-side, not here)
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      // ── Compliance rule #3: never show error state ────────────────────
      // Rate-limit messages are the exception — they're informational, not errors
      if (err instanceof ApiError && err.status === 429) {
        toast.info(err.message);
      }
      setState('idle');
    }
  }

  const isLoading = state === 'loading';
  const isDone    = state === 'done';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading || isDone}
      className={[
        'flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all duration-150 select-none',
        'disabled:cursor-not-allowed',
        isDone
          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
          : disabled
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:scale-[0.98]',
        className,
      ].join(' ')}
    >
      {isLoading ? (
        <>
          <span className="animate-spin text-base">⏳</span>
          <span>Loading ad…</span>
        </>
      ) : isDone ? (
        <>
          <span>✅</span>
          <span>Reward claimed!</span>
        </>
      ) : (
        <>
          <span className="text-base">🎬</span>
          <span>{label}</span>
          {cooldownText && (
            <span className="text-xs opacity-60 ml-1">({cooldownText})</span>
          )}
        </>
      )}
    </button>
  );
}
