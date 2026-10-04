'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './icons';

export interface ToastOptions {
  /** Milliseconds before auto-dismiss. 0 keeps it until dismissed. Default 4000. */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: ReactNode;
}

interface ToastApi {
  toast: (message: ReactNode, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Hosts the polite live region and provides `useToast()`. Mounted once in the root layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const toast = useCallback(
    (message: ReactNode, options?: ToastOptions) => {
      seq.current += 1;
      const id = seq.current;
      setItems((list) => [...list.slice(-2), { id, message }]);
      const duration = options?.duration ?? 4000;
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="gl-toasts" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className="gl-toast">
            <span className="gl-toast__msg">{t.message}</span>
            <button type="button" className="gl-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <IconClose width={16} height={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `const { toast } = useToast(); toast('Copied to clipboard')`. No-ops outside the provider. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { toast: () => -1, dismiss: () => {} };
}
