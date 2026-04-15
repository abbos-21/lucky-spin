import { useState, useEffect, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const EMOJIS = ['🍎','🍊','🍋','🍇','🍓','🫐','🍑','🥝'];
const GRID_SIZE = 4; // 4×4 = 16 cards = 8 pairs

type Phase = 'ready' | 'playing' | 'done';

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  // Fisher-Yates shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

export default function MemoryMatch({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [pairs, setPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [locked, setLocked] = useState(false);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startTime]);

  const endGame = useCallback((finalPairs: number, finalMoves: number, elapsed: number) => {
    setPhase('done');
    haptic.success();
    // Score = pairs * 100 - moves penalty - time penalty (min 50)
    const score = Math.max(50, finalPairs * 100 - (finalMoves - finalPairs) * 5 - Math.floor(elapsed / 2));
    onComplete(score);
  }, [onComplete]);

  function startGame() {
    setCards(buildDeck());
    setSelected([]);
    setPairs(0);
    setMoves(0);
    setStartTime(Date.now());
    setElapsedSec(0);
    setLocked(false);
    setPhase('playing');
  }

  function handleCardClick(id: number) {
    if (locked) return;
    const card = cards[id];
    if (card.flipped || card.matched) return;
    if (selected.includes(id)) return;

    haptic.light();
    const newSelected = [...selected, id];
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));

    if (newSelected.length === 2) {
      setMoves((m) => m + 1);
      setLocked(true);

      const [a, b] = newSelected;
      const cardA = cards[a];
      const cardB = cards[b];

      if (cardA.emoji === cardB.emoji) {
        // Match!
        haptic.success();
        const newPairs = pairs + 1;
        setCards((prev) =>
          prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c))
        );
        setPairs(newPairs);
        setSelected([]);
        setLocked(false);

        if (newPairs === EMOJIS.length) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          endGame(newPairs, moves + 1, elapsed);
        }
      } else {
        // No match — flip back after delay
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c))
          );
          setSelected([]);
          setLocked(false);
        }, 900);
      }
    } else {
      setSelected(newSelected);
    }
  }

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">🧠</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Memory Match</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Flip cards to find all <strong>8 matching pairs</strong>. Fewer moves = higher score!
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Completed!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {moves} moves · {elapsedSec}s
          </p>
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

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-between w-full max-w-xs text-sm text-gray-500 dark:text-gray-400">
        <span>Pairs: {pairs}/{EMOJIS.length}</span>
        <span>Moves: {moves}</span>
        <span>⏱ {elapsedSec}s</span>
      </div>

      {/* 4×4 grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, width: '100%', maxWidth: 280 }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className={[
              'aspect-square rounded-xl text-2xl flex items-center justify-center font-bold transition-all duration-200 select-none',
              card.matched
                ? 'bg-green-100 dark:bg-green-900/30 scale-95'
                : card.flipped
                ? 'bg-white dark:bg-gray-700 shadow-md scale-105'
                : 'bg-gray-200 dark:bg-gray-700 active:scale-95',
            ].join(' ')}
            style={{ minHeight: 60 }}
          >
            {card.flipped || card.matched ? card.emoji : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
