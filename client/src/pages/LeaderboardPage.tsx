import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import type { LeaderboardEntry, LeaderboardResult } from '../lib/api';
import { getTodayGameLabel } from '../config/constants';

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.game.leaderboard()
      .then(setData)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load leaderboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="space-y-3 w-full max-w-sm px-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 px-4">
        <p className="text-4xl">😓</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">{error}</p>
        <button
          className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const gameLabel = getTodayGameLabel();
  const currentUser = data?.entries.find((e) => e.isCurrentUser);
  const isInTop50 = Boolean(currentUser);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">🏆 Today's Rankings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{gameLabel}</p>
      </div>

      {/* No submissions yet */}
      {(!data || data.entries.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <p className="text-4xl">🎮</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
            No scores yet today. Be the first!
          </p>
        </div>
      )}

      {/* Ranking list */}
      {data && data.entries.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {/* Top 3 podium */}
          {data.entries.length >= 3 && (
            <div className="flex items-end justify-center gap-3 px-4 pt-5 pb-4">
              {/* 2nd */}
              <PodiumCard entry={data.entries[1]} position={2} />
              {/* 1st */}
              <PodiumCard entry={data.entries[0]} position={1} />
              {/* 3rd */}
              <PodiumCard entry={data.entries[2]} position={3} />
            </div>
          )}

          {/* Rest of the list */}
          <div className="px-4 pb-4 space-y-2">
            {data.entries.slice(3).map((entry) => (
              <RankRow key={entry.userId} entry={entry} />
            ))}
          </div>

          {/* Current user footer (if not in top 50) */}
          {!isInTop50 && data.currentUserRank && (
            <div className="sticky bottom-0 px-4 pb-4 pt-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-orange-500">#{data.currentUserRank}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">You</span>
                </div>
                <span className="text-xs text-gray-400">Not in top 50</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
  const heights = { 1: 'h-24', 2: 'h-16', 3: 'h-12' } as Record<number, string>;
  const colors  = { 1: 'bg-yellow-400', 2: 'bg-gray-300', 3: 'bg-amber-600' } as Record<number, string>;
  const medals  = { 1: '🥇', 2: '🥈', 3: '🥉' } as Record<number, string>;

  const name = entry.firstName ?? entry.username ?? `#${entry.rank}`;

  return (
    <div className={`flex flex-col items-center gap-1 ${position === 1 ? 'order-2' : position === 2 ? 'order-1' : 'order-3'}`}>
      {entry.photoUrl ? (
        <img src={entry.photoUrl} alt={name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow">
          {name[0]?.toUpperCase()}
        </div>
      )}
      {entry.isCurrentUser && <span className="text-[10px] text-orange-500 font-bold">You</span>}
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 max-w-[60px] truncate">{name}</p>
      <p className="text-xs font-black text-gray-900 dark:text-white">{entry.score.toLocaleString()}</p>
      {entry.isBoosted && <span className="text-[9px] text-purple-500">⚡2×</span>}
      <div className={`w-14 ${heights[position]} ${colors[position]} rounded-t-lg flex items-start justify-center pt-1`}>
        <span className="text-lg">{medals[position]}</span>
      </div>
    </div>
  );
}

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const name = entry.firstName ?? entry.username ?? `Player ${entry.rank}`;
  const isYou = entry.isCurrentUser;

  return (
    <div
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
        isYou
          ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
          : 'bg-gray-50 dark:bg-gray-800',
      ].join(' ')}
    >
      <span className="w-6 text-center text-sm font-bold text-gray-400">
        {entry.rank}
      </span>

      {entry.photoUrl ? (
        <img src={entry.photoUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {name[0]?.toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isYou ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
          {name} {isYou && '(You)'}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black text-gray-900 dark:text-white">
          {entry.score.toLocaleString()}
        </p>
        {entry.isBoosted && (
          <p className="text-[10px] text-purple-500">⚡ 2×</p>
        )}
      </div>
    </div>
  );
}
