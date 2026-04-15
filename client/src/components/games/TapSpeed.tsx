import { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const DURATION_SECS = 10;

type Phase = 'ready' | 'playing' | 'done';

export default function TapSpeed({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endCalledRef = useRef(false);

  const endGame = useCallback((finalTaps: number) => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    setPhase('done');
    haptic.success();
    // Score = tap count capped to 200 for sanity
    onComplete(Math.min(finalTaps, 200));
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'playing') return;
    endCalledRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setTaps((current) => {
            endGame(current);
            return current;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [phase, endGame]);

  function startGame() {
    setTaps(0);
    setTimeLeft(DURATION_SECS);
    endCalledRef.current = false;
    setPhase('playing');
  }

  function handleTap() {
    if (phase !== 'playing') return;
    haptic.light();
    setTaps((t) => t + 1);
  }

  const timerPct = (timeLeft / DURATION_SECS) * 100;
  const timerColor = timeLeft > 5 ? '#22C55E' : timeLeft > 2 ? '#F59E0B' : '#EF4444';

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">👆</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tap Speed</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Tap the button as many times as possible in <strong>10 seconds</strong>!
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
          <p className="text-5xl">🎉</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Done!</h2>
          <p className="text-4xl font-black text-orange-500">{taps}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">taps in 10 seconds</p>
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
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Timer bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Time left</span>
          <span className="font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${timerPct}%`, background: timerColor }}
          />
        </div>
      </div>

      {/* Tap count */}
      <div className="text-center">
        <p className="text-6xl font-black text-orange-500 leading-none">{taps}</p>
        <p className="text-gray-400 text-sm mt-1">taps</p>
      </div>

      {/* The tap button — big, satisfying */}
      <button
        onPointerDown={handleTap}
        className="w-48 h-48 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white text-5xl shadow-2xl active:scale-90 transition-transform select-none"
        style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        👆
      </button>

      <p className="text-xs text-gray-400">TAP FAST!</p>
    </div>
  );
}
