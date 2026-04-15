import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { initTelegramApp } from './lib/telegram';
import { initAdsgram } from './lib/adsgram';
import { api, ApiError } from './lib/api';
import { getFingerprintCached } from './lib/fingerprint';
import BottomNav from './components/BottomNav';
import ToastContainer from './components/ToastContainer';
import SpinPage from './pages/SpinPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import EarnPage from './pages/EarnPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const { activeTab, isLoading, initError, setUser, setStats, setLoading, setInitError } = useStore();

  useEffect(() => {
    // Initialize Telegram WebApp SDK
    initTelegramApp();

    // Initialize Adsgram SDK
    initAdsgram();

    // Initialize user
    async function init() {
      try {
        setLoading(true);

        // Get device fingerprint for anti-abuse
        const fingerprintHash = await getFingerprintCached().catch(() => undefined);

        const { user } = await api.user.init(fingerprintHash);
        setUser(user);

        // Load full profile stats in background
        api.user.profile().then(({ user: fullUser, stats }) => {
          setUser(fullUser);
          setStats(stats);
        }).catch(() => {
          // Non-critical — init data is enough to render
        });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Failed to connect to server. Please try again.';
        setInitError(message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-bounce">🎰</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">
            Loading Lucky Spin...
          </p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900 p-6">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-4">😓</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Connection failed
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{initError}</p>
          <button
            className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <ToastContainer />

      {/* Page content — padded bottom for BottomNav */}
      <main className="flex-1 overflow-y-auto pb-16">
        {activeTab === 'spin'    && <SpinPage />}
        {activeTab === 'game'    && <GamePage />}
        {activeTab === 'board'   && <LeaderboardPage />}
        {activeTab === 'earn'    && <EarnPage />}
        {activeTab === 'profile' && <ProfilePage />}
      </main>

      <BottomNav />
    </div>
  );
}
