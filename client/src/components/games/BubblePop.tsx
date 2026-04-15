import { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const DURATION_SECS = 30;

const BUBBLE_COLORS = [
  { emoji: '🔴', name: 'Red' },
  { emoji: '🔵', name: 'Blue' },
  { emoji: '🟢', name: 'Green' },
  { emoji: '🟡', name: 'Yellow' },
  { emoji: '🟣', name: 'Purple' },
];

interface Bubble {
  id: number;
  colorIdx: number;
  x: number;       // % from left
  size: number;    // px
  speed: number;   // animation duration seconds
  visible: boolean;
}

type Phase = 'ready' | 'playing' | 'done';

let nextId = 0;

function makeBubble(): Bubble {
  return {
    id: nextId++,
    colorIdx: Math.floor(Math.random() * BUBBLE_COLORS.length),
    x: 5 + Math.random() * 80,
    size: 44 + Math.floor(Math.random() * 20),
    speed: 2.5 + Math.random() * 3,
    visible: true,
  };
}

export default function BubblePop({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [targetColorIdx, setTargetColorIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECS);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endCalledRef = useRef(false);

  const endGame = useCallback((finalScore: number) => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    clearInterval(spawnRef.current!);
    clearInterval(timerRef.current!);
    setPhase('done');
    haptic.success();
    onComplete(finalScore);
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'playing') return;
    endCalledRef.current = false;

    // Spawn new bubbles
    spawnRef.current = setInterval(() => {
      setBubbles((prev) => {
        const visible = prev.filter((b) => b.visible);
        if (visible.length < 8) {
          return [...prev.slice(-20), makeBubble()];
        }
        return prev;
      });
    }, 600);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setScore((s) => { endGame(s); return s; });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(spawnRef.current!);
      clearInterval(timerRef.current!);
    };
  }, [phase, endGame]);

  function startGame() {
    nextId = 0;
    endCalledRef.current = false;
    setScore(0);
    setTimeLeft(DURATION_SECS);
    setTargetColorIdx(Math.floor(Math.random() * BUBBLE_COLORS.length));
    setBubbles(Array.from({ length: 5 }, makeBubble));
    setPhase('playing');
  }

  function popBubble(bubble: Bubble) {
    if (phase !== 'playing') return;

    setBubbles((prev) => prev.map((b) => b.id === bubble.id ? { ...b, visible: false } : b));

    if (bubble.colorIdx === targetColorIdx) {
      haptic.light();
      setScore((s) => {
        const newScore = s + 5;
        // Change target every 10 correct pops
        if (newScore % 50 === 0 && newScore > 0) {
          setTargetColorIdx(Math.floor(Math.random() * BUBBLE_COLORS.length));
        }
        return newScore;
      });
    } else {
      haptic.error();
      setScore((s) => Math.max(0, s - 3));
    }
  }

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">🫧</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bubble Pop</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Pop only the <strong>target color</strong> bubbles as they float up! +5 correct, -3 wrong. 30 seconds!
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
          <p className="text-5xl">🫧</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Time's up!</h2>
          <p className="text-4xl font-black text-orange-500">{score}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">bubbles popped correctly</p>
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

  const visibleBubbles = bubbles.filter((b) => b.visible);
  const timerPct = (timeLeft / DURATION_SECS) * 100;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="w-full space-y-1">
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Pop:</span>
            <span className="text-2xl">{BUBBLE_COLORS[targetColorIdx].emoji}</span>
            <span className="font-bold text-gray-700 dark:text-gray-200">{BUBBLE_COLORS[targetColorIdx].name}</span>
          </div>
          <div className="text-right">
            <p className="font-bold text-orange-500">{score} pts</p>
            <p className={`text-xs ${timeLeft <= 10 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{timeLeft}s</p>
          </div>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-1000"
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Bubble field */}
      <div
        className="relative w-full bg-gradient-to-b from-sky-50 to-blue-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl overflow-hidden"
        style={{ height: 300 }}
      >
        {visibleBubbles.map((bubble) => (
          <button
            key={bubble.id}
            onClick={() => popBubble(bubble)}
            className="absolute bottom-0 flex items-center justify-center select-none active:scale-75"
            style={{
              left: `${bubble.x}%`,
              width: bubble.size,
              height: bubble.size,
              fontSize: bubble.size * 0.6,
              animation: `float ${bubble.speed}s linear forwards`,
              touchAction: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {BUBBLE_COLORS[bubble.colorIdx].emoji}
          </button>
        ))}

        <style>{`
          @keyframes float {
            0%   { transform: translateY(0) scale(1); opacity: 1; }
            80%  { opacity: 1; }
            100% { transform: translateY(-320px) scale(0.8); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
