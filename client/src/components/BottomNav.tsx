import { useStore } from '../store/useStore';
import { haptic } from '../lib/telegram';

interface Tab {
  id: 'spin' | 'game' | 'board' | 'earn' | 'profile';
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'spin',    label: 'Spin',    icon: '🎰' },
  { id: 'game',    label: 'Game',    icon: '🎮' },
  { id: 'board',   label: 'Board',   icon: '🏆' },
  { id: 'earn',    label: 'Earn',    icon: '💰' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  const { activeTab, setActiveTab } = useStore();

  function handleTabClick(tab: Tab['id']) {
    if (tab === activeTab) return;
    haptic.selection();
    setActiveTab(tab);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-pb">
      <div className="flex items-stretch h-16">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150',
                isActive
                  ? 'text-orange-500'
                  : 'text-gray-400 dark:text-gray-500 active:text-orange-400',
              ].join(' ')}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={`text-xl transition-transform duration-150 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-orange-500 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
