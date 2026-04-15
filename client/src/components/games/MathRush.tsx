import { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../../lib/telegram';

interface Props {
  mode: 'practice' | 'submit';
  onComplete: (score: number) => void;
}

const DURATION_SECS = 60;

type Phase = 'ready' | 'playing' | 'done';

interface Question {
  text: string;
  answer: number;
  choices: number[];
}

function makeQuestion(): Question {
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];

  let a: number, b: number, answer: number;

  if (op === '+') {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 50) + 10;
    b = Math.floor(Math.random() * a);
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
    answer = a * b;
  }

  // Build 4 choices including the correct one
  const wrongPool = new Set<number>();
  while (wrongPool.size < 3) {
    const delta = Math.floor(Math.random() * 10) + 1;
    const wrong = answer + (Math.random() > 0.5 ? delta : -delta);
    if (wrong !== answer && wrong >= 0) wrongPool.add(wrong);
  }

  const choices = [answer, ...Array.from(wrongPool)];
  // Shuffle choices
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { text: `${a} ${op} ${b} = ?`, answer, choices };
}

export default function MathRush({ mode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [question, setQuestion] = useState<Question>(makeQuestion());
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_SECS);
  const [feedback, setFeedback] = useState<number | null>(null); // which choice was tapped
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
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
    setCorrect(0);
    setWrong(0);
    setTimeLeft(DURATION_SECS);
    setFeedback(null);
    setIsCorrect(null);
    setLocked(false);
    setQuestion(makeQuestion());
    setPhase('playing');
  }

  function handleAnswer(choice: number) {
    if (phase !== 'playing' || locked) return;
    setLocked(true);
    setFeedback(choice);

    if (choice === question.answer) {
      haptic.light();
      setIsCorrect(true);
      setScore((s) => s + 10);
      setCorrect((c) => c + 1);
    } else {
      haptic.error();
      setIsCorrect(false);
      setScore((s) => Math.max(0, s - 5));
      setWrong((w) => w + 1);
    }

    setTimeout(() => {
      setFeedback(null);
      setIsCorrect(null);
      setLocked(false);
      setQuestion(makeQuestion());
    }, 500);
  }

  const timerPct = (timeLeft / DURATION_SECS) * 100;

  if (phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center space-y-2">
          <p className="text-5xl">🔢</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Math Rush</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
            Answer math questions as fast as you can! +10 correct, -5 wrong. 60 seconds!
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
          <p className="text-5xl">🔢</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Time's up!</h2>
          <p className="text-4xl font-black text-orange-500">{score}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            ✅ {correct} correct · ❌ {wrong} wrong
          </p>
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
    <div className="flex flex-col items-center gap-5">
      {/* Timer */}
      <div className="w-full max-w-xs space-y-1">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
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

      {/* Question */}
      <div
        className={`w-full max-w-xs py-6 rounded-2xl text-center transition-colors ${
          isCorrect === true  ? 'bg-green-100 dark:bg-green-900/30' :
          isCorrect === false ? 'bg-red-100 dark:bg-red-900/30'     :
          'bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <p className="text-3xl font-black text-gray-900 dark:text-white">{question.text}</p>
      </div>

      {/* Answer choices */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {question.choices.map((choice) => {
          const isTapped = feedback === choice;
          const bg = isTapped
            ? choice === question.answer
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

          return (
            <button
              key={choice}
              onClick={() => handleAnswer(choice)}
              className={`py-4 rounded-xl font-bold text-xl shadow active:scale-95 transition-all ${bg}`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">✅ {correct} · ❌ {wrong}</p>
    </div>
  );
}
