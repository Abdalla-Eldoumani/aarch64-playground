"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MAX_ARGS_CHARS } from "@/lib/playground/upload-guard";
import { usePersistedFlag } from "@/components/panels/register-panel-settings";
import type { StepGoal } from "@/lib/emulator/emulator-state";
import { PaneSwitch } from "@/components/playground/PaneSwitch";
import { StepGoals } from "@/components/playground/lazy-step-goals";
import { RunStatus, type RunStatusProps } from "@/components/playground/RunStatus";

export interface EmbedLayoutProps {
  editor: ReactNode;
  registers: ReactNode;
  /** The stack frames view, which a frame that can step offers in the
   *  registers' place; the frame before it engages has none to show yet. */
  stack?: ReactNode;
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
  /** Step over, step out, run to cursor: offered wherever step is. */
  onRunUntil: (goal: StepGoal) => void;
  /** Why the last of those stopped, until the machine moves again. */
  stopReason: string | null;
  onCheck: () => void;
  /** What the status line under a narrow frame's code reports. */
  runStatus: Omit<RunStatusProps, "showPeek" | "onOpenRegisters">;
  /** The program has printed something, so a finished run is worth
   *  switching a narrow frame to the console for. */
  hasOutput: boolean;
}

type Pane = "editor" | "registers" | "console";

// The stack shares the registers' area, so its view is that pane with the
// stored side flipped.
const VIEWS: { label: string; pane: Pane; stack?: boolean }[] = [
  { label: "code", pane: "editor" },
  { label: "registers", pane: "registers", stack: false },
  { label: "stack", pane: "registers", stack: true },
  { label: "console", pane: "console" },
];

const STACK_KEY = "aarch64-playground:embed-stack";

// On a phone the run buttons share the frame's width and wrap to a second
// row rather than scroll: the old single scrolling strip put check, the one
// button an exercise needs, past the right edge of every phone.
const SHARE = "flex-1 min-w-[3.5rem] sm:flex-none";

// One secondary-control string for step, back, and reset.
const SECONDARY =
  `${SHARE} min-h-[44px] px-2 sm:px-4 rounded border border-[var(--border)] text-[var(--text-primary)] text-sm disabled:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]`;

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
  stack,
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
  onRunUntil,
  stopReason,
  onCheck,
  runStatus,
  hasOutput,
}: EmbedLayoutProps) {
  const [pane, setPane] = useState<Pane>("editor");
  // Registers first, as before; a student who picks the stack keeps it on
  // every lesson and exercise. Only a frame that can step offers it.
  const [stackSide, setStackSide] = usePersistedFlag(STACK_KEY);
  const showStack = showStep && stackSide;
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
        {VIEWS.filter((v) => showStep || v.stack !== true).map((v) => {
          const on = pane === v.pane && (v.stack === undefined || v.stack === showStack);
          return (
            <button
              key={v.label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPane(v.pane);
                if (v.stack !== undefined) setStackSide(v.stack);
              }}
              className={`h-11 flex-1 font-sans text-[13px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cyan)] ${
                on
                  ? "text-[var(--cyan)] [box-shadow:inset_0_-2px_0_0_var(--cyan)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 embed-grid" data-pane={pane}>
        <div className="embed-area-editor min-h-0 min-w-0 flex flex-col">{editor}</div>
        <div className="embed-area-registers min-h-0 min-w-0 flex flex-col">
          {showStep && (
            // The single-pane switch above carries the same choice there.
            <div className="embed-side">
              <PaneSwitch
                label="registers or stack"
                names={["registers", "stack"]}
                second={stackSide}
                onChange={setStackSide}
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">{showStack ? stack : registers}</div>
        </div>
        <div className="embed-area-console min-h-0 min-w-0 overflow-hidden flex flex-col">
          {console}
        </div>
      </div>
      <div className="embed-status">
        <RunStatus
          {...runStatus}
          showPeek={pane !== "registers" || showStack}
          onOpenRegisters={() => {
            setPane("registers");
            setStackSide(false);
          }}
        />
      </div>
      <div className="flex flex-col gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] sm:flex-row sm:items-center">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {args && (
            // The next run assembles with whatever this holds, so a student
            // can try the command lines the hidden inputs use. Check keeps the
            // authored args, since the expected output was written for them.
            <label className="inline-flex shrink-0 basis-full items-center gap-1.5 font-mono text-[12px] text-[var(--text-secondary)] sm:basis-auto">
              args
              <input
                type="text"
                value={args.value}
                onChange={(event) => args.onChange(event.target.value)}
                maxLength={MAX_ARGS_CHARS}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
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
              className={`${SHARE} min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium disabled:bg-[var(--bg-sunken)] disabled:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]`}
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
          {showStep && <StepGoals onRunUntil={onRunUntil} disabled={!canStep} className={SECONDARY} />}
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
            embedded run that faults just stops silently. It wraps rather
            than ending in an ellipsis: a phone has no hover for a title. */}
        {error && (
          <p
            role="alert"
            className="min-w-0 flex-1 break-words font-mono text-[12px] text-[var(--danger)]"
          >
            {error}
          </p>
        )}
        {stopReason && !error && (
          <p role="status" className="min-w-0 flex-1 break-words font-mono text-[12px] text-[var(--text-secondary)]">
            {stopReason}
          </p>
        )}
      </div>
    </div>
  );
}
