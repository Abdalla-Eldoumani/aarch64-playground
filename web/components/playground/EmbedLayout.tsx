"use client";

import type { ReactNode } from "react";

export interface EmbedLayoutProps {
  editor: ReactNode;
  registers: ReactNode;
  console: ReactNode;
  showRun: boolean;
  showReset: boolean;
  /** Step and back. On by default; the hero's autoplay frame opts out so the
   *  demo stays a two-button surface. */
  showStep: boolean;
  showBack: boolean;
  /** Checker chrome only; the shell folds the chrome test into this flag. */
  showCheck: boolean;
  /** Disables run while one is in flight -- a halted machine still runs
   *  again, because the embedded run re-assembles first. */
  isRunning: boolean;
  /** Step is live with nothing loaded and on a halted machine: the embedded
   *  step assembles first, the same way the embedded run does. */
  canStep: boolean;
  canStepBack: boolean;
  error: string | null;
  onRun: () => void;
  onReset: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onCheck: () => void;
}

// One secondary-control string for step, back, and reset.
const SECONDARY =
  "min-h-[44px] px-4 rounded border border-[var(--border)] text-[var(--text-primary)] text-sm disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]";

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
  showStep,
  showBack,
  showCheck,
  isRunning,
  canStep,
  canStepBack,
  error,
  onRun,
  onReset,
  onStep,
  onStepBack,
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
      <div className="flex flex-col gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] sm:flex-row sm:items-center">
        <div className="controls-band flex items-center gap-2">
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
          {/* Neither of these advertises aria-keyshortcuts: F10 and Shift+F10
              are bound by the playground page, and no embed host binds them. */}
          {showStep && (
            <button
              type="button"
              onClick={onStep}
              disabled={!canStep}
              aria-label="step"
              className={SECONDARY}
            >
              step
            </button>
          )}
          {showBack && (
            <button
              type="button"
              onClick={onStepBack}
              disabled={!canStepBack}
              aria-label="back"
              className={SECONDARY}
            >
              back
            </button>
          )}
          {showReset && (
            <button
              type="button"
              onClick={onReset}
              aria-label="reset"
              className={SECONDARY}
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
        </div>
        {/* A fault must be visible here too: full chrome surfaces the
            machine's error through Controls, and without this line an
            embedded run that faults just stops silently. It sits outside the
            scrolling strip so a phone swipe cannot carry it out of reach. */}
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
