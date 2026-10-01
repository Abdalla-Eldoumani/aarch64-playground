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

/** The usual double-click interval: a second press this soon after the
 *  first belongs to the same double press. */
const DOUBLE_PRESS_MS = 500;

/**
 * Keeps keyboard focus inside an open dialog: focus starts on its first
 * control, Tab wraps, Escape calls `onClose`, and focus goes back where it
 * was on close. The caller still renders `role="dialog" aria-modal="true"`
 * and the backdrop, whose click goes through closeOnBackdropClick.
 *
 * Enter or Space pressed twice on the opener would land the second press on
 * the control that just took focus (the close button, or the palette's first
 * command), so right after opening those two keys do nothing until the
 * double-press interval passes or the reader types anything else.
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
    const openedAt = performance.now();
    let armed = true;
    // Capture on the document runs before React's own key handlers.
    const swallowSecondPress = (e: Event) => {
      if (!armed) return;
      const key = e instanceof KeyboardEvent ? e.key : "";
      if (key !== "Enter" && key !== " ") {
        if (e.type !== "keyup") armed = false;
        return;
      }
      // A key held down since the opener repeats into the dialog for as long
      // as it is held, so a repeat is held back after the interval too.
      if ((e as KeyboardEvent).repeat || performance.now() - openedAt < DOUBLE_PRESS_MS) {
        e.preventDefault();
        e.stopPropagation();
      } else armed = false;
    };
    const events = ["keydown", "keyup", "input"] as const;
    for (const type of events) document.addEventListener(type, swallowSecondPress, true);
    return () => {
      for (const type of events) document.removeEventListener(type, swallowSecondPress, true);
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
