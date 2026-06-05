import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;
const DISMISS_DELAY: Record<ToastType, number> = {
  success: 3500,
  info: 4000,
  error: 6000, // errors stay longer so users can read them
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => dismiss(id), DISMISS_DELAY[type]);
    timers.current.set(id, timer);
  }, [dismiss]);

  const ctx: ToastContextValue = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast stack — fixed bottom-right */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="alert"
            className={`
              pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg
              border text-sm max-w-sm w-full animate-slide-in
              ${toast.type === 'success' ? 'bg-white border-green-200' : ''}
              ${toast.type === 'error'   ? 'bg-white border-red-200' : ''}
              ${toast.type === 'info'    ? 'bg-white border-indigo-200' : ''}
            `}
          >
            {/* Icon */}
            <span className={`shrink-0 mt-0.5 ${
              toast.type === 'success' ? 'text-green-500' :
              toast.type === 'error'   ? 'text-red-500' : 'text-indigo-500'
            }`}>
              {toast.type === 'success' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </span>

            {/* Message */}
            <span className="flex-1 text-gray-800 font-medium">{toast.message}</span>

            {/* Dismiss button */}
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 -mt-0.5 -mr-1 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
