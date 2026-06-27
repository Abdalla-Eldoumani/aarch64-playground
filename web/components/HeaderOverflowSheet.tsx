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
        className="absolute left-0 right-0 bottom-0 max-h-[70vh] overflow-y-auto bg-[var(--bg-sunken)] border-t border-[var(--border)] rounded-t-lg p-3"
      >
        {/* Each action lays out in a row with a 44px min height so
            touch targets meet WCAG 2.5.5; consumers that nest a button
            group (e.g. ImportExport's import/.asm/.s/copy) opt out via
            `data-sheet-row="group"` so their inner buttons stay
            inline. */}
        <div className="sheet-actions flex flex-col gap-1.5 [&>*]:min-h-[44px] [&>*]:flex [&>*]:items-center [&>*]:w-full [&>button]:justify-start [&>button]:px-3 [&>a]:px-3 [&>select]:px-3 [&>select]:w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
