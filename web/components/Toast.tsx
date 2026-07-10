"use client";

import { type ReactNode, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";

interface ToastApi {
  /** Default success notification (check-mark icon). The legacy
   *  `useToast().show("...")` call sites lean on this -- treat it as
   *  the "operation completed" toast. */
  show: (message: string) => void;
  /** Explicit success toast with a check-mark icon. */
  success: (message: string) => void;
  /** Error toast with the cross icon and a longer dwell time. */
  error: (message: string) => void;
  /** Neutral / informational toast (no icon). */
  info: (message: string) => void;
}

/**
 * Mounts the global `<Toaster />` and renders children. Kept as a
 * named "ToastHost" so the layout import doesn't change. The actual
 * toast queue + animation now lives in react-hot-toast; this wrapper
 * just provides the scope.
 */
export function ToastHost({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          // Match the playground's design tokens so the toast doesn't
          // look transplanted from another app. Uses CSS vars so each
          // theme (dark / light / high-contrast) renders the toast in
          // its own palette.
          style: {
            background: "var(--bg-panel)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            fontSize: "12px",
            padding: "8px 12px",
            borderRadius: "6px",
            boxShadow: "0 4px 14px rgb(0 0 0 / 0.35)",
          },
          success: {
            iconTheme: {
              primary: "var(--success)",
              secondary: "var(--bg-panel)",
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: "var(--danger)",
              secondary: "var(--bg-panel)",
            },
          },
        }}
      />
    </>
  );
}

/**
 * Hook returning the toast API. Backwards-compatible with the old
 * `{ show }` shape; new call sites should prefer the explicit
 * `success` / `error` / `info` methods so the right icon and dwell
 * time render.
 */
export function useToast(): ToastApi {
  return useMemo<ToastApi>(
    () => ({
      show: (m) => toast.success(m),
      success: (m) => toast.success(m),
      error: (m) => toast.error(m),
      info: (m) => toast(m),
    }),
    [],
  );
}
