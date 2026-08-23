"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { CREDIBILITY } from "@/lib/content/site";

export interface Shortcut {
  keys: string;
  description: string;
}

export interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}

/**
 * `?` help modal listing every keyboard shortcut the app registers.
 * Renders nothing when closed so keyboard focus stays wherever it was.
 */
export function ShortcutsHelp({ open, onClose, shortcuts }: ShortcutsHelpProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
      role="dialog"
      aria-modal="true"
      aria-label="keyboard shortcuts"
      onClick={onClose}
    >
      <div
        ref={ref}
        className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl p-5 anim-modal-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-base font-semibold tracking-tight text-[var(--text-primary)] mb-3">
          keyboard shortcuts
        </h2>
        <dl className="text-xs space-y-1.5">
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-[var(--text-secondary)]">{s.description}</dt>
              <dd>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)] font-mono">
                  {s.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
        {/* The playground renders no footer, so this modal carries the
            course-context disclaimer the other routes state there. */}
        <p className="mt-3 border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
          {CREDIBILITY.disclaimer}
        </p>
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
