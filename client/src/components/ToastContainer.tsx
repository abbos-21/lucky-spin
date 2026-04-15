import { useStore } from '../store/useStore';

const ICONS = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

const BG = {
  success: 'bg-green-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  warning: 'bg-yellow-500',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${BG[toast.type]} text-white rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg pointer-events-auto animate-fade-in`}
          onClick={() => removeToast(toast.id)}
        >
          <span>{ICONS[toast.type]}</span>
          <span className="text-sm font-medium flex-1">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
