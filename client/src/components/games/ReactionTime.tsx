import { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const ROUNDS = 5;
const MIN_WAIT_MS = 1500;
const MAX_WAIT_MS = 4000;

type Phase = 'ready' | 'waiting' | 'react' | 'toosoon' | 'result' | 'done';

export default function ReactionTime({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [reactionMs, setReactionMs] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactStartRef = useRef<number>(0);

  const endGame = useCallback((times: number[]) => {
    setPhase('done');
    haptic.success();
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    // Score = max(0, 1500 - avgMs). Ranges from 0 (>1500ms) to 1450 (50ms reaction)
    const score = Math.max(0, Math.round(1500 - avg));
    onComplete(score);
  }, [onComplete]);

  function startRound() {
    setPhase('waiting');
    const delay = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
    waitTimerRef.current = setTimeout(() => {
      reactStartRef.current = Date.now();
      setPhase('react');
    }, delay);
  }

  function startGame() {
    setRound(0);
    setReactionMs([]);
    setLastMs(null);
    startRound();
  }

  function handleTap() {
    if (phase === 'waiting') {
      // Too soon!
      clearTimeout(waitTimerRef.current!);
      setPhase('toosoon');
      haptic.error();
      setTimeout(() => startRound(), 1500);
      return;
    }

    if (phase === 'react') {
      const ms = Date.now() - reactStartRef.current;
      setLastMs(ms);
      haptic.medium();

      const newTimes = [...reactionMs, ms];
      const newRound = round + 1;

      setReactionMs(newTimes);
      setRound(newRound);

      if (newRound >= ROUNDS) {
        setPhase('result');
        setTimeout(() => endGame(newTimes), 1500);
      } else {
        setPhase('result');
        setTimeout(() => startRound(), 1200);
      }
    }
  }

  useEffect(() => {
    return () => clearTimeout(waitTimerRef.current!);
  }, []);

  function avgMs(): number {
    if (reactionMs.length === 0) return 0;
    return Math.round(reactionMs.reduce((a, b) => a + b, 0) / reactionMs.length);
  }

  const bgColor = {
    ready: 'bg-gray-100 dark:bg-gray-800',
    waiting: 'bg-red-100 dark:bg-red-900/30',
    react: 'bg-green-400 dark:bg-green-500',
    toosoon: 'bg-yellow-100 dark:bg-yellow-900/30',
    result: 'bg-gray-100 dark:bg-gray-800',
    done: 'bg-gray-100 dark:bg-gray-800',
  }[phase];

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">⚡</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reaction Time</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Wait for the screen to turn <strong className="text-green-500">GREEN</strong>, then tap as fast as you can!
            <br />{ROUNDS} rounds.
          </p>
        </div>
        <button
          className="px-10 py-4 bg-orange-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform shadow-lg"
          onClick={startGame}
        >
          Start!
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">⚡</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Result</h2>
          <p className="text-4xl font-black text-orange-500">{avgMs()}ms</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">average reaction time</p>
          <div className="flex gap-2 justify-center flex-wrap mt-2">
            {reactionMs.map((ms, i) => (
              <span key={i} className="text-xs bg-gray-200 dark:bg-gray-700 rounded px-2 py-1">
                #{i + 1}: {ms}ms
              </span>
            ))}
          </div>
        </div>
        {mode === 'practice' && (
          <button
            className="px-8 py-3 bg-orange-500 text-white rounded-xl font-semibold active:scale-95 transition-transform"
            onClick={startGame}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-between w-full max-w-xs text-sm text-gray-500 dark:text-gray-400">
        <span>Round {round + (phase === 'react' || phase === 'waiting' ? 1 : 0)}/{ROUNDS}</span>
        {reactionMs.length > 0 && <span>Avg: {avgMs()}ms</span>}
      </div>

      {/* Reaction area — full tap zone */}
      <button
        onClick={handleTap}
        className={`w-full rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors duration-100 select-none ${bgColor}`}
        style={{ height: 220, touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        {phase === 'waiting' && (
          <>
            <p className="text-4xl">🔴</p>
            <p className="text-gray-500 dark:text-gray-400 font-semibold">Wait…</p>
          </>
        )}
        {phase === 'react' && (
          <>
            <p className="text-4xl">🟢</p>
            <p className="text-white font-bold text-xl">TAP NOW!</p>
          </>
        )}
        {phase === 'toosoon' && (
          <>
            <p className="text-4xl">⚠️</p>
            <p className="text-yellow-600 dark:text-yellow-400 font-semibold">Too soon! Wait for green…</p>
          </>
        )}
        {phase === 'result' && lastMs !== null && (
          <>
            <p className="text-4xl">✅</p>
            <p className="text-2xl font-black text-orange-500">{lastMs}ms</p>
            <p className="text-gray-400 text-sm">
              {lastMs < 200 ? 'Incredible!' : lastMs < 300 ? 'Great!' : lastMs < 500 ? 'Good' : 'Keep practicing'}
            </p>
          </>
        )}
      </button>

      {/* Round dots */}
      <div className="flex gap-2">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${i < reactionMs.length ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          />
        ))}
      </div>
    </div>
  );
}
