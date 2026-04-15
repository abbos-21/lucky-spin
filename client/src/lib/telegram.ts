// Telegram WebApp SDK helpers
// The SDK is loaded via script tag in index.html

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };
    start_param?: string;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  CloudStorage: {
    setItem(key: string, value: string, callback?: (err: Error | null, stored: boolean) => void): void;
    getItem(key: string, callback: (err: Error | null, value: string | null) => void): void;
    getItems(keys: string[], callback: (err: Error | null, values: Record<string, string>) => void): void;
    removeItem(key: string, callback?: (err: Error | null, removed: boolean) => void): void;
    removeItems(keys: string[], callback?: (err: Error | null, removed: boolean) => void): void;
    getKeys(callback: (err: Error | null, keys: string[]) => void): void;
  };
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText(text: string): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
  };
  BackButton: {
    isVisible: boolean;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    show(): void;
    hide(): void;
  };
}

export const twa: TelegramWebApp | null =
  typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null;

/** Call once on app mount */
export function initTelegramApp(): void {
  if (!twa) return;
  twa.ready();
  twa.expand();

  // Apply Telegram theme colors as CSS variables
  applyTheme();

  // Prevent closing mini app by accidental swipe-down
  twa.enableClosingConfirmation();
}

/** Apply Telegram theme params as CSS custom properties */
export function applyTheme(): void {
  if (!twa) return;
  const p = twa.themeParams;
  const root = document.documentElement;

  if (p.bg_color) root.style.setProperty('--tg-theme-bg-color', p.bg_color);
  if (p.text_color) root.style.setProperty('--tg-theme-text-color', p.text_color);
  if (p.hint_color) root.style.setProperty('--tg-theme-hint-color', p.hint_color);
  if (p.link_color) root.style.setProperty('--tg-theme-link-color', p.link_color);
  if (p.button_color) root.style.setProperty('--tg-theme-button-color', p.button_color);
  if (p.button_text_color) root.style.setProperty('--tg-theme-button-text-color', p.button_text_color);
  if (p.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', p.secondary_bg_color);

  // Sync dark/light class
  if (twa.colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// ─── Haptic helpers ──────────────────────────────────────────────────────────

export const haptic = {
  light: () => twa?.HapticFeedback.impactOccurred('light'),
  medium: () => twa?.HapticFeedback.impactOccurred('medium'),
  heavy: () => twa?.HapticFeedback.impactOccurred('heavy'),
  success: () => twa?.HapticFeedback.notificationOccurred('success'),
  error: () => twa?.HapticFeedback.notificationOccurred('error'),
  warning: () => twa?.HapticFeedback.notificationOccurred('warning'),
  selection: () => twa?.HapticFeedback.selectionChanged(),
};

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Get raw initData string for auth header */
export function getInitData(): string {
  return twa?.initData ?? '';
}

/** Get Telegram user object */
export function getTelegramUser() {
  return twa?.initDataUnsafe?.user ?? null;
}

/** Open external link */
export function openLink(url: string): void {
  twa?.openLink(url);
}

/** Open Telegram link (t.me/...) */
export function openTelegramLink(url: string): void {
  twa?.openTelegramLink(url);
}
