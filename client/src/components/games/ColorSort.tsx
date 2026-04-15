import { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const COLORS = ['🔴', '🔵', '🟢', '🟡'];
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];
const DURATION_SECS = 30;

type Phase = 'ready' | 'playing' | 'done';

interface Ball {
  id: number;
  colorIdx: number;
}

function makeQueue(count: number): Ball[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    colorIdx: Math.floor(Math.random() * COLORS.length),
  }));
}

export default function ColorSort({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [queue, setQueue] = useState<Ball[]>([]);
  const [targetColorIdx, setTargetColorIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECS);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endCalledRef = useRef(false);

  const endGame = useCallback((finalScore: number) => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    clearInterval(timerRef.current!);
    setPhase('done');
    haptic.success();
    onComplete(finalScore);
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'playing') return;
    endCalledRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setScore((s) => { endGame(s); return s; });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [phase, endGame]);

  function startGame() {
    endCalledRef.current = false;
    setScore(0);
    setTimeLeft(DURATION_SECS);
    setFeedback(null);
    setTargetColorIdx(Math.floor(Math.random() * COLORS.length));
    setQueue(makeQueue(40));
    setPhase('playing');
  }

  function handleBall(ball: Ball) {
    if (phase !== 'playing') return;

    if (ball.colorIdx === targetColorIdx) {
      haptic.light();
      setFeedback('correct');
      setScore((s) => s + 5);
      // Remove ball and shift
      setQueue((q) => {
        const next = q.filter((b) => b.id !== ball.id);
        if (next.length < 5) {
          return [...next, ...makeQueue(20)];
        }
        return next;
      });
      // Change target color every 5 correct
      setScore((s) => {
        if (s % 25 === 0 && s > 0) {
          setTargetColorIdx(Math.floor(Math.random() * COLORS.length));
        }
        return s;
      });
    } else {
      haptic.error();
      setFeedback('wrong');
      setScore((s) => Math.max(0, s - 3));
    }

    setTimeout(() => setFeedback(null), 300);
  }

  const timerPct = (timeLeft / DURATION_SECS) * 100;

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">🎨</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Color Sort</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Tap only the balls matching the <strong>target color</strong>. +5 for correct, -3 for wrong. 30 seconds!
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
          <p className="text-5xl">🎨</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Time's up!</h2>
          <p className="text-4xl font-black text-orange-500">{score}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">points scored</p>
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

  const displayBalls = queue.slice(0, 12);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Score: <strong className="text-orange-500">{score}</strong></span>
          <span className={timeLeft <= 10 ? 'text-red-500 font-bold' : ''}>{timeLeft}s</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Target */}
      <div
        className={`flex flex-col items-center justify-center w-full py-3 rounded-2xl transition-colors ${
          feedback === 'correct' ? 'bg-green-100 dark:bg-green-900/30' :
          feedback === 'wrong'   ? 'bg-red-100 dark:bg-red-900/30'    :
          'bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tap all:</p>
        <p className="text-4xl">{COLORS[targetColorIdx]}</p>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{COLOR_NAMES[targetColorIdx]}</p>
      </div>

      {/* Ball grid */}
      <div className="grid grid-cols-4 gap-3 w-full max-w-xs">
        {displayBalls.map((ball) => (
          <button
            key={ball.id}
            onClick={() => handleBall(ball)}
            className="aspect-square text-3xl flex items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow active:scale-90 transition-transform select-none"
            style={{ touchAction: 'none' }}
          >
            {COLORS[ball.colorIdx]}
          </button>
        ))}
      </div>
    </div>
  );
}
