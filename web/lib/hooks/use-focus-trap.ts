"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
}

/**
 * Trap focus inside a modal-style container while it is open. On open,
 * focuses the first focusable child and remembers what was previously
 * focused. Tab + Shift+Tab cycle within the container; Escape calls
 * `onClose`. On close, restores focus to the previously-focused element.
 *
 * Caller still renders `role="dialog" aria-modal="true"` and any backdrop
 * dismissal; this hook only handles keyboard focus management.
 */
export function useFocusTrap(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = getFocusables(ref.current);
    focusables[0]?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open, ref]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = getFocusables(ref.current);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, ref, onClose]);
}
