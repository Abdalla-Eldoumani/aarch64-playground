"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ToastApi {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const HIDE_AFTER_MS = 3000;

/**
 * Wrap the app once. Children inside can call `useToast()` to fire a
 * 3-second polite announcement. Single-message queue: the latest call
 * wins so a burst of imports collapses to one visible toast.
 */
export function ToastHost({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(next);
    timerRef.current = setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message != null && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-16 sm:bottom-auto sm:left-auto sm:translate-x-0 sm:top-12 sm:right-4 z-50 px-3 py-2 rounded-md text-xs bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-primary)] shadow-lg"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be called inside <ToastHost>");
  }
  return ctx;
}
