import { useState } from 'react';
import { useStore } from '../store/useStore';
import WithdrawPage from './WithdrawPage';
import CollectiblesGrid from '../components/CollectiblesGrid';
import AnimatedNumber from '../components/AnimatedNumber';

export default function ProfilePage() {
  const { user, stats } = useStore();
  const [showWithdraw, setShowWithdraw] = useState(false);

  if (!user) return null;

  if (showWithdraw) {
    return <WithdrawPage onBack={() => setShowWithdraw(false)} />;
  }

  const withdrawUnlocked = user.activeDays >= 14;

  return (
    <div className="flex flex-col min-h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={user.firstName ?? 'User'}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
            {user.firstName?.[0] ?? '?'}
          </div>
        )}
        <div>
          <p className="font-bold text-lg text-gray-900 dark:text-white">
            {user.firstName ?? 'Player'}
          </p>
          {user.username && (
            <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
          )}
        </div>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Points (pending)</p>
            <AnimatedNumber value={user.pointsBalance} className="text-xl font-bold text-orange-500" />
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">TON balance</p>
          <AnimatedNumber
            value={user.tonBalance}
            format={(n) => n.toFixed(4)}
            className="text-xl font-bold text-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Stats</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Streak</span>
            <span className="font-medium">🔥 {user.streak}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Best streak</span>
            <span className="font-medium">{user.longestStreak}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Active days</span>
            <span className="font-medium">{user.activeDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total spins</span>
            <span className="font-medium">{stats?.totalSpins ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Games played</span>
            <span className="font-medium">{stats?.totalGameSubmissions ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Coins</span>
            <span className="font-medium">{user.coins.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Collectibles */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
        <CollectiblesGrid
          owned={new Set(stats?.collectibles?.map((c) => c.collectibleId) ?? [])}
        />
      </div>

      {/* Withdrawal unlock progress */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Withdrawal unlock
          </span>
          <span className="text-xs text-gray-500">{user.activeDays}/14 days</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (user.activeDays / 14) * 100)}%` }}
          />
        </div>
        {withdrawUnlocked ? (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">✅ Withdrawals unlocked!</p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            {14 - user.activeDays} more day{14 - user.activeDays !== 1 ? 's' : ''} to unlock
          </p>
        )}
      </div>

      {/* Withdraw button */}
      <button
        className="w-full py-3.5 rounded-xl bg-blue-500 text-white font-semibold text-sm shadow-md active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!withdrawUnlocked}
        onClick={() => setShowWithdraw(true)}
      >
        💸 Withdraw TON
      </button>

      {!withdrawUnlocked && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 -mt-2">
          Keep playing to unlock withdrawals
        </p>
      )}
    </div>
  );
}
