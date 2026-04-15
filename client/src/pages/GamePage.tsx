import { useState, useEffect, lazy, Suspense, ComponentType } from 'react';
import { useStore, useToast } from '../store/useStore';
import { api, ApiError } from '../lib/api';
import { haptic } from '../lib/telegram';
import AdButton from '../components/AdButton';
import { getTodayGame, getTodayGameLabel } from '../config/constants';

// Lazy-load game components to keep the main bundle lean
const TapSpeed     = lazy(() => import('../components/games/TapSpeed'));
const MemoryMatch  = lazy(() => import('../components/games/MemoryMatch'));
const ReactionTime = lazy(() => import('../components/games/ReactionTime'));
const ColorSort    = lazy(() => import('../components/games/ColorSort'));
const MathRush     = lazy(() => import('../components/games/MathRush'));
const EmojiRecall  = lazy(() => import('../components/games/EmojiRecall'));
const BubblePop    = lazy(() => import('../components/games/BubblePop'));

interface GameProps { mode: 'practice' | 'submit'; onComplete: (score: number) => void; }
const GAME_MAP: Record<string, React.LazyExoticComponent<ComponentType<GameProps>>> = {
  TapSpeed, MemoryMatch, ReactionTime, ColorSort, MathRush, EmojiRecall, BubblePop,
};

type Mode = 'menu' | 'practice' | 'playing' | 'review' | 'submitted';

interface SubmitResult {
  score: number;
  rawScore: number;
  isBoosted: boolean;
  rank: number;
}

export default function GamePage() {
  const { updateBalance } = useStore();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('menu');
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [adScoreBoost, setAdScoreBoost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const gameType  = getTodayGame();
  const gameLabel = getTodayGameLabel();
  const GameComponent = GAME_MAP[gameType];

  // Load today's game status on mount
  useEffect(() => {
    api.game.status()
      .then(({ submitted, submission, adScoreBoost: boost }) => {
        setAlreadySubmitted(submitted);
        setAdScoreBoost(boost);
        if (submitted && submission) {
          setSubmitResult({
            score: submission.score,
            rawScore: submission.rawScore,
            isBoosted: submission.isBoosted,
            rank: 0, // rank not returned by status — will show after leaderboard
          });
          setMode('submitted');
        }
      })
      .catch(() => {
        // Non-critical — proceed with defaults
      })
      .finally(() => setStatusLoaded(true));
  }, []);

  async function handleSubmit(boosted: boolean) {
    if (pendingScore === null) return;
    setSubmitting(true);
    haptic.medium();

    try {
      const result = await api.game.submit(gameType, pendingScore, boosted);
      setSubmitResult(result as SubmitResult);
      setAlreadySubmitted(true);
      setMode('submitted');
      haptic.success();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Submit failed.';
      toast.error(msg);
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  if (!statusLoaded) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <div className="h-20 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse mx-auto w-48" />
        <div className="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

  // ── Menu / lobby ───────────────────────────────────────────────────────────
  if (mode === 'menu') {
    return (
      <div className="flex flex-col min-h-full px-4 py-6 gap-5">
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Today's Game</p>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">{gameLabel}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {GAME_DESCRIPTIONS[gameType] ?? 'Play to score!'}
          </p>
        </div>

        {alreadySubmitted && submitResult ? (
          /* Already played today */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 text-center w-full max-w-xs">
              <p className="text-5xl mb-3">✅</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">Score submitted!</p>
              <p className="text-4xl font-black text-orange-500 mt-1">{submitResult.score}</p>
              {submitResult.isBoosted && (
                <p className="text-xs text-purple-500 mt-1">⚡ 2× boost applied</p>
              )}
              {submitResult.rank > 0 && (
                <p className="text-sm text-gray-500 mt-2">Rank #{submitResult.rank}</p>
              )}
            </div>
            <button
              className="w-full max-w-xs py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-sm active:scale-95 transition-transform"
              onClick={() => setMode('practice')}
            >
              🎮 Practice mode
            </button>
          </div>
        ) : (
          /* Not played yet */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {/* Ad boost option (Phase 3 will wire real ad) */}
            {adScoreBoost && (
              <div className="w-full max-w-xs bg-purple-50 dark:bg-purple-900/20 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                  ⚡ 2× score boost active!
                </p>
              </div>
            )}

            <button
              className="w-full max-w-xs py-4 rounded-2xl bg-orange-500 text-white font-bold text-lg active:scale-95 transition-transform shadow-lg"
              onClick={() => setMode('playing')}
            >
              🎮 Play for real
            </button>

            <button
              className="w-full max-w-xs py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm active:scale-95 transition-transform"
              onClick={() => setMode('practice')}
            >
              Practice first (no submission)
            </button>

            <p className="text-xs text-gray-400 text-center max-w-xs">
              You can only submit once per day. Practice as much as you like!
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Active game ────────────────────────────────────────────────────────────
  if (mode === 'practice' || mode === 'playing') {
    if (!GameComponent) {
      return (
        <div className="flex items-center justify-center min-h-full">
          <p className="text-gray-400">Game not found: {gameType}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-full px-4 py-4 gap-4">
        <div className="flex items-center justify-between">
          <button
            className="text-sm text-gray-500 active:scale-95"
            onClick={() => setMode('menu')}
          >
            ← Back
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{gameLabel}</p>
            <p className="text-xs text-gray-400">
              {mode === 'practice' ? 'Practice' : 'For real!'}
            </p>
          </div>
          <div className="w-12" />
        </div>

        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-gray-400 animate-pulse">Loading game…</p></div>}>
          <GameComponent
            mode={mode === 'practice' ? 'practice' : 'submit'}
            onComplete={(score: number) => {
              setPendingScore(score);
              setMode('review');
            }}
          />
        </Suspense>
      </div>
    );
  }

  // ── Review screen (after practice or real play) ────────────────────────────
  if (mode === 'review') {
    const isPractice = alreadySubmitted; // if already submitted, this must be practice
    return (
      <div className="flex flex-col min-h-full px-4 py-6 gap-5 items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-5xl">🎯</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Score</h2>
          <p className="text-5xl font-black text-orange-500">{pendingScore}</p>
          {adScoreBoost && !isPractice && (
            <p className="text-xs text-purple-500">⚡ 2× boost will be applied on submit</p>
          )}
        </div>

        <div className="w-full max-w-xs space-y-3">
          {isPractice ? (
            /* Already submitted — can only practice again */
            <>
              <button
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base active:scale-95 transition-transform"
                onClick={() => setMode('practice')}
              >
                🔄 Try Again (Practice)
              </button>
              <button
                className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm active:scale-95 transition-transform"
                onClick={() => setMode('menu')}
              >
                Back to menu
              </button>
            </>
          ) : (
            /* Real play — offer ad boost or plain submit */
            <>
              {/* Ad boost button — secondary, smaller; hidden once boost is active */}
              {!adScoreBoost && (
                <AdButton
                  adType="rewarded_score"
                  label="Watch ad → Submit at 2×"
                  onSuccess={(pts) => {
                    updateBalance(pts);
                    setAdScoreBoost(true);
                    toast.success('2× boost activated!');
                  }}
                  className="w-full py-3"
                />
              )}

              {adScoreBoost && (
                <div className="w-full py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-center">
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">⚡ 2× boost active — score will be doubled!</p>
                </div>
              )}

              {/* Primary submit — bigger, more prominent */}
              <button
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base active:scale-95 transition-transform shadow-lg disabled:opacity-50"
                disabled={submitting}
                onClick={() => handleSubmit(adScoreBoost)}
              >
                {submitting ? 'Submitting…' : `✅ Submit Score (${adScoreBoost ? pendingScore! * 2 : pendingScore})`}
              </button>

              <button
                className="w-full py-3 rounded-xl bg-transparent text-gray-400 text-sm active:scale-95"
                onClick={() => setMode('playing')}
                disabled={submitting}
              >
                Try again first (won't submit this attempt)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Already submitted ──────────────────────────────────────────────────────
  if (mode === 'submitted' && submitResult) {
    return (
      <div className="flex flex-col min-h-full px-4 py-6 gap-5 items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-5xl">✅</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Submitted!</h2>
          <p className="text-5xl font-black text-orange-500">{submitResult.score}</p>
          {submitResult.isBoosted && (
            <p className="text-sm text-purple-500">⚡ 2× boost applied (raw: {submitResult.rawScore})</p>
          )}
          {submitResult.rank > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You're ranked <strong>#{submitResult.rank}</strong> today
            </p>
          )}
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button
            className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-base active:scale-95 transition-transform shadow-lg"
            onClick={() => setMode('practice')}
          >
            🎮 Practice mode
          </button>
          <button
            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm active:scale-95 transition-transform"
            onClick={() => setMode('menu')}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// Game descriptions shown on the menu screen
const GAME_DESCRIPTIONS: Record<string, string> = {
  TapSpeed:     'Tap as fast as you can for 10 seconds!',
  MemoryMatch:  'Find all matching emoji pairs on the board.',
  ReactionTime: 'Tap when the screen turns green — fastest wins.',
  ColorSort:    'Tap the matching color bubbles before time runs out.',
  MathRush:     'Solve quick math questions — speed and accuracy win.',
  EmojiRecall:  'Memorize emojis, then pick them from a crowd.',
  BubblePop:    'Pop the right color bubbles as they float up.',
};
