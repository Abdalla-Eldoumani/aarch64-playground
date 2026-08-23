"use client";

import type { ReactNode } from "react";

export interface EmbedLayoutProps {
  editor: ReactNode;
  registers: ReactNode;
  console: ReactNode;
  showRun: boolean;
  showReset: boolean;
  /** Checker chrome only; the shell folds the chrome test into this flag. */
  showCheck: boolean;
  /** Disables run while one is in flight -- a halted machine still runs
   *  again, because the embedded run re-assembles first. */
  isRunning: boolean;
  error: string | null;
  onRun: () => void;
  onReset: () => void;
  onCheck: () => void;
}

/**
 * The reduced embed / checker chrome: editor, registers, console, and a
 * minimal control set. Full-only panels (and their code) never load here.
 * The three-pane arrangement comes from the container-driven embed-grid areas
 * in globals.css, so each host's own width (a prose measure, a wide hero)
 * picks the layout rather than the viewport.
 */
export function EmbedLayout({
  editor,
  registers,
  console,
  showRun,
  showReset,
  showCheck,
  isRunning,
  error,
  onRun,
  onReset,
  onCheck,
}: EmbedLayoutProps) {
  return (
    <div className="embed-layout flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 embed-grid">
        <div className="embed-area-editor min-h-0 min-w-0 flex flex-col">{editor}</div>
        <div className="embed-area-registers min-h-0 min-w-0 overflow-auto">
          {registers}
        </div>
        <div className="embed-area-console min-h-0 min-w-0 overflow-hidden flex flex-col">
          {console}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
        {showRun && (
          // Run stays available on a halted machine: the embedded run
          // re-assembles and restarts, so a finished (or edited) program runs
          // again without a reset. Only an in-flight run disables it.
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            aria-label="run"
            className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            run
          </button>
        )}
        {showReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label="reset"
            className="min-h-[44px] px-4 rounded border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            reset
          </button>
        )}
        {showCheck && (
          <button
            type="button"
            onClick={onCheck}
            aria-label="check"
            className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            check
          </button>
        )}
        {/* A fault must be visible here too: full chrome surfaces the
            machine's error through Controls, and without this line an
            embedded run that faults just stops silently. */}
        {error && (
          <p
            role="alert"
            title={error}
            className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--danger)]"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
