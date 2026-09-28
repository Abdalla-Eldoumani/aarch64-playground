"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MAX_ARGS_CHARS } from "@/lib/playground/upload-guard";
import { RunStatus, type RunStatusProps } from "@/components/playground/RunStatus";

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
  /** The command-line box, present only when the host asks for one. */
  args?: { value: string; onChange: (next: string) => void };
  /** Disables run while one is in flight; a halted machine still runs again,
   *  because the embedded run re-assembles first. */
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
  /** What the status line under a narrow frame's code reports. */
  runStatus: Omit<RunStatusProps, "showPeek" | "onOpenRegisters">;
  /** The program has printed something, so a finished run is worth
   *  switching a narrow frame to the console for. */
  hasOutput: boolean;
}

type Pane = "editor" | "registers" | "console";

const PANES: { id: Pane; label: string }[] = [
  { id: "editor", label: "code" },
  { id: "registers", label: "registers" },
  { id: "console", label: "console" },
];

// On a phone the run buttons share the frame's width and wrap to a second
// row rather than scroll: the old single scrolling strip put check, the one
// button an exercise needs, past the right edge of every phone.
const SHARE = "flex-1 min-w-[3.5rem] sm:flex-none";

// One secondary-control string for step, back, and reset.
const SECONDARY =
  `${SHARE} min-h-[44px] px-4 rounded border border-[var(--border)] text-[var(--text-primary)] text-sm disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]`;

/**
 * The embedded frame: code, registers, console, and a few controls. The
 * embed-grid rules in globals.css follow the frame's own width, not the
 * viewport. A frame under 56rem on a screen under 640px or a touch screen
 * shows one pane at a time behind a switch, since stacked panes there left no
 * room for a register row or the console's input; CSS hides the switch and
 * the status line everywhere else.
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
  args,
  isRunning,
  canStep,
  canStepBack,
  error,
  onRun,
  onReset,
  onStep,
  onStepBack,
  onCheck,
  runStatus,
  hasOutput,
}: EmbedLayoutProps) {
  const [pane, setPane] = useState<Pane>("editor");
  // A read that blocks, or a run that finishes having printed, brings the
  // console forward in a narrow frame, the way the phone playground does.
  const [seen, setSeen] = useState({ blocked: runStatus.blocked, running: isRunning });
  if (seen.blocked !== runStatus.blocked || seen.running !== isRunning) {
    setSeen({ blocked: runStatus.blocked, running: isRunning });
    const readBlocked = runStatus.blocked && !seen.blocked;
    const runFinished = seen.running && !isRunning && runStatus.isHalted && hasOutput;
    if (readBlocked || runFinished) setPane("console");
  }

  return (
    <div className="embed-layout flex flex-col flex-1 min-h-0">
      <div
        role="group"
        aria-label="view"
        className="embed-view border-b border-[var(--border)] bg-[var(--bg-sunken)]"
      >
        {PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={pane === p.id}
            onClick={() => setPane(p.id)}
            className={`h-11 flex-1 font-sans text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cyan)] ${
              pane === p.id
                ? "text-[var(--cyan)] [box-shadow:inset_0_-2px_0_0_var(--cyan)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 embed-grid" data-pane={pane}>
        <div className="embed-area-editor min-h-0 min-w-0 flex flex-col">{editor}</div>
        <div className="embed-area-registers min-h-0 min-w-0 overflow-auto">
          {registers}
        </div>
        <div className="embed-area-console min-h-0 min-w-0 overflow-hidden flex flex-col">
          {console}
        </div>
      </div>
      <div className="embed-status">
        <RunStatus
          {...runStatus}
          showPeek={pane !== "registers"}
          onOpenRegisters={() => setPane("registers")}
        />
      </div>
      <div className="flex flex-col gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] sm:flex-row sm:items-center">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {args && (
            // The next run or check assembles with whatever this holds, so a
            // student can try the command lines the hidden inputs use.
            <label className="inline-flex shrink-0 basis-full items-center gap-1.5 font-mono text-[12px] text-[var(--text-secondary)] sm:basis-auto sm:text-[11px]">
              args
              <input
                type="text"
                value={args.value}
                onChange={(event) => args.onChange(event.target.value)}
                maxLength={MAX_ARGS_CHARS}
                spellCheck={false}
                autoComplete="off"
                className="min-h-[44px] w-36 rounded border border-[var(--border)] bg-[var(--bg-base)] px-2 font-mono text-[12px] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] sm:w-44"
              />
            </label>
          )}
          {showRun && (
            // Run stays available on a halted machine: the embedded run
            // re-assembles and restarts, so a finished (or edited) program runs
            // again without a reset. Only an in-flight run disables it.
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              aria-label="run"
              className={`${SHARE} min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]`}
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
              className="basis-full min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] sm:basis-auto"
            >
              check
            </button>
          )}
        </div>
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
