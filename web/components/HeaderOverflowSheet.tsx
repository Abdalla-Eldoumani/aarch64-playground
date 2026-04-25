"use client";

import { useRef, type ReactNode } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface HeaderOverflowSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

/**
 * Bottom-sheet modal for header overflow on narrow viewports. Children
 * are the secondary action buttons; the sheet provides the chrome,
 * focus trap, escape-close, and tap-outside-close.
 */
export function HeaderOverflowSheet({
  open,
  onClose,
  children,
  ariaLabel = "more actions",
}: HeaderOverflowSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-40 bg-black/40"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "var(--safe-bottom)" }}
        className="absolute left-0 right-0 bottom-0 bg-[var(--bg-secondary)] border-t border-[var(--border)] rounded-t-lg p-3"
      >
        <div className="grid grid-cols-3 gap-2">{children}</div>
      </div>
    </div>
  );
}
