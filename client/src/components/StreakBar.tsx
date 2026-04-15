const MILESTONE_DAYS = [3, 7, 14, 30];

interface Props {
  streak: number;
  longestStreak: number;
  streakShield: boolean;
}

export default function StreakBar({ streak, longestStreak, streakShield }: Props) {
  // Show 7 dots representing the current week of streaking
  const dots = Array.from({ length: 7 }, (_, i) => i + 1);

  const nextMilestone = MILESTONE_DAYS.find((m) => m > streak) ?? null;

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              {streak}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              day streak
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streakShield && (
            <span className="text-sm px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-medium text-xs">
              🛡 Shield active
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Best: {longestStreak}
          </span>
        </div>
      </div>

      {/* 7-dot progress bar */}
      <div className="flex items-center gap-1.5">
        {dots.map((day) => {
          const isMilestone = streak >= day && MILESTONE_DAYS.includes(day);
          return (
            <div
              key={day}
              className={[
                'flex-1 h-2 rounded-full transition-all duration-300',
                day <= (streak % 7 === 0 && streak > 0 ? 7 : streak % 7)
                  ? isMilestone
                    ? 'bg-yellow-400'
                    : 'bg-orange-500'
                  : 'bg-gray-200 dark:bg-gray-700',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* Next milestone hint */}
      {nextMilestone && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {nextMilestone - streak} day{nextMilestone - streak !== 1 ? 's' : ''} to {nextMilestone}-day milestone
          </span>
          <span className="text-[10px] font-medium text-orange-500">
            🏆 Bonus reward
          </span>
        </div>
      )}
    </div>
  );
}
