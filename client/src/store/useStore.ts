import { create } from 'zustand';
import type { User, UserStats } from '../lib/api';

interface AppState {
  // ── User ──────────────────────────────────────────────────
  user: User | null;
  stats: UserStats | null;
  isLoading: boolean;
  initError: string | null;

  // ── UI ────────────────────────────────────────────────────
  activeTab: 'spin' | 'game' | 'board' | 'earn' | 'profile';
  toasts: Toast[];

  // ── Actions ───────────────────────────────────────────────
  setUser: (user: User) => void;
  setStats: (stats: UserStats) => void;
  setLoading: (loading: boolean) => void;
  setInitError: (error: string | null) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  updateBalance: (pointsDelta: number, tonDelta?: number, coinsDelta?: number) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  stats: null,
  isLoading: true,
  initError: null,
  activeTab: 'spin',
  toasts: [],

  setUser: (user) => set({ user }),
  setStats: (stats) => set({ stats }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitError: (initError) => set({ initError }),
  setActiveTab: (activeTab) => set({ activeTab }),

  updateBalance: (pointsDelta, tonDelta = 0, coinsDelta = 0) => {
    const { user } = get();
    if (!user) return;
    set({
      user: {
        ...user,
        pointsBalance: Math.max(0, user.pointsBalance + pointsDelta),
        tonBalance: Math.max(0, user.tonBalance + tonDelta),
        coins: Math.max(0, user.coins + coinsDelta),
      },
    });
  },

  addToast: (toast) => {
    const id = crypto.randomUUID();
    const newToast: Toast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-remove after duration
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

// Convenience hook for toast notifications
export function useToast() {
  const addToast = useStore((s) => s.addToast);
  return {
    success: (message: string) => addToast({ type: 'success', message }),
    error: (message: string) => addToast({ type: 'error', message }),
    info: (message: string) => addToast({ type: 'info', message }),
    warning: (message: string) => addToast({ type: 'warning', message }),
  };
}
