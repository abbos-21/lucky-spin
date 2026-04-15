import { useState, useEffect, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const ALL_EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐙','🐧','🐦','🦆','🦅','🦉',
  '🦋','🐛','🐝','🐞','🦀','🐡','🐠','🦈','🐳','🦜',
];

const SHOW_COUNT = 6;    // emojis to memorize
const POOL_SIZE  = 12;   // emojis shown during recall (6 correct + 6 distractors)
const SHOW_MS    = 4000; // how long emojis are shown

type Phase = 'ready' | 'memorize' | 'countdown' | 'recall' | 'done';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EmojiRecall({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [targets, setTargets] = useState<string[]>([]);
  const [pool, setPool] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(3);
  const [memorizeLeft, setMemorizeLeft] = useState(SHOW_MS / 1000);
  const [_round, setRound] = useState(1);

  function buildRound() {
    const shuffled = shuffle([...ALL_EMOJIS]);
    const tgts = shuffled.slice(0, SHOW_COUNT);
    const distractors = shuffled.slice(SHOW_COUNT, POOL_SIZE);
    setTargets(tgts);
    setPool(shuffle([...tgts, ...distractors]));
    setSelected(new Set());
  }

  function startGame() {
    setRound(1);
    buildRound();
    setMemorizeLeft(SHOW_MS / 1000);
    setPhase('memorize');
  }

  // Memorize timer
  useEffect(() => {
    if (phase !== 'memorize') return;
    const interval = setInterval(() => {
      setMemorizeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setCountdown(3);
          setPhase('countdown');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Countdown 3-2-1
  useEffect(() => {
    if (phase !== 'countdown') return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase('recall');
          return 0;
        }
        return c - 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [phase]);

  const endGame = useCallback((sel: Set<string>, tgts: string[]) => {
    setPhase('done');
    haptic.success();
    const correctCount = [...sel].filter((e) => tgts.includes(e)).length;
    const wrongCount   = [...sel].filter((e) => !tgts.includes(e)).length;
    const score = Math.max(0, correctCount * 20 - wrongCount * 10);
    onComplete(score);
  }, [onComplete]);

  function handleSelect(emoji: string) {
    if (phase !== 'recall') return;
    haptic.light();

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(emoji)) {
        next.delete(emoji);
      } else {
        next.add(emoji);
        // Auto-submit once they've selected SHOW_COUNT emojis
        if (next.size === SHOW_COUNT) {
          setTimeout(() => endGame(next, targets), 300);
        }
      }
      return next;
    });
  }

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">🧩</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Emoji Recall</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Memorize <strong>{SHOW_COUNT} emojis</strong> in 4 seconds, then pick them from the crowd!
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

  if (phase === 'memorize') {
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Memorize these!</p>
          <p className="text-xs text-gray-400">{memorizeLeft}s remaining…</p>
        </div>
        <div className="w-full max-w-xs bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-1000"
              style={{ width: `${(memorizeLeft / (SHOW_MS / 1000)) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {targets.map((e) => (
              <div key={e} className="aspect-square flex items-center justify-center text-4xl bg-white dark:bg-gray-700 rounded-xl shadow">
                {e}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-8xl font-black text-orange-500 animate-bounce-in">{countdown}</p>
        <p className="text-gray-400">Get ready to recall!</p>
      </div>
    );
  }

  if (phase === 'done') {
    const correctCount = [...selected].filter((e) => targets.includes(e)).length;
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">🧩</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Done!</h2>
          <p className="text-4xl font-black text-orange-500">{correctCount}/{SHOW_COUNT}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">emojis recalled correctly</p>
        </div>
        {mode === 'practice' && (
          <button
            className="px-8 py-3 bg-orange-500 text-white rounded-xl font-semibold active:scale-95 transition-transform"
            onClick={startGame}
          >
            Play Again
          </button>
        )}
      </div>
    );
  }

  // Recall phase
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Select the {SHOW_COUNT} emojis you saw
        </p>
        <p className="text-xs text-gray-400">{selected.size}/{SHOW_COUNT} selected</p>
      </div>

      <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
        {pool.map((emoji) => {
          const isSel = selected.has(emoji);
          return (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className={[
                'aspect-square flex items-center justify-center text-3xl rounded-xl transition-all select-none',
                isSel
                  ? 'bg-orange-500 scale-105 shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 active:scale-95',
              ].join(' ')}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">Tap to select • {SHOW_COUNT - selected.size} more needed</p>
    </div>
  );
}
