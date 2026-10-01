"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
}

/**
 * The click handler for a dialog's backdrop. A double press on the button
 * that opens a dialog lands its second click on the backdrop the first one
 * just drew, so a click that is the second of a double press (`detail` above
 * 1) leaves the dialog open.
 */
export function closeOnBackdropClick(onClose: () => void): (e: { detail: number }) => void {
  return (e) => {
    if (e.detail <= 1) onClose();
  };
}

/**
 * Keeps keyboard focus inside an open dialog: focus starts on its first
 * control, Tab wraps, Escape calls `onClose`, and focus goes back where it
 * was on close. The caller still renders `role="dialog" aria-modal="true"`
 * and the backdrop, whose click goes through closeOnBackdropClick.
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
