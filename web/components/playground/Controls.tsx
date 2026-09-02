"use client";

import { Button } from "@/components/ui/Button";
import { explainError } from "@/lib/asm/error-explain";

interface ControlsProps {
  onAssemble: () => void;
  onStep: () => void;
  onStepBack?: () => void;
  canStepBack?: boolean;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
  /** True while an assemble is in flight; the first one also downloads
   *  and compiles the emulator, so the button must visibly say so. */
  isAssembling?: boolean;
  isHalted: boolean;
  /** False until a successful assemble, and false again after reset or a
   *  failed one. Run, step, and back have nothing to execute without a
   *  program, so they render disabled instead of silently no-oping. */
  programLoaded: boolean;
  /** Run has something to do even with nothing assembled: it assembles the
   *  workspace first and starts the session itself. Only run is affected --
   *  step and back still need a loaded program -- and an assemble already
   *  in flight still disables it, so one press cannot start two. */
  runAssemblesFirst?: boolean;
  /** True while the program sits at a blocked read waiting for stdin. Run,
   *  step, and back cannot make progress past the read (the machine just
   *  re-blocks), so they disable; assemble and reset stay live because both
   *  genuinely escape the wait by starting over. */
  blocked?: boolean;
  error: string | null;
  stepCount?: number;
}

export function Controls({
  onAssemble,
  onStep,
  onStepBack,
  canStepBack,
  onRun,
  onPause,
  onReset,
  isRunning,
  isAssembling = false,
  isHalted,
  programLoaded,
  runAssemblesFirst = false,
  blocked = false,
  error,
  stepCount,
}: ControlsProps) {
  // The step counter uses a key tied to the count so the scale-up animation
  // restarts each step without extra effects. The visible 44px controls are
  // the obvious path; the page owns the keyboard shortcuts (a single window
  // listener), so these buttons advertise them via aria-keyshortcuts without
  // binding any keys themselves.

  // The plain-language cause/hint replaces the raw error string alone, so
  // a beginner's first failed program reads as instructive, not alarming.
  const explanation = error ? explainError(error) : null;

  return (
    <div
      style={{ paddingBottom: "calc(0.5rem + var(--safe-bottom))" }}
      className="flex flex-col gap-1.5 px-2 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] sm:flex-row sm:items-center sm:gap-2 sm:px-4"
    >
      {/* Under sm the controls take one nowrap strip that scrolls within
          itself, so the fifth button is reachable instead of clipped, and the
          assemble error drops to its own row underneath rather than off the
          right edge. At sm and up the band dissolves and every control is a
          direct child of the row again, laid out as it always was. */}
      <div className="controls-band flex items-center gap-1.5 sm:contents">
        <Button
          variant="primary"
          onClick={onAssemble}
          disabled={isAssembling}
          aria-label="assemble"
          aria-busy={isAssembling}
          aria-keyshortcuts="F6"
          title="F6"
        >
          <span>{isAssembling ? "loading…" : "assemble"}</span>
          <Shortcut keys="F6" />
        </Button>
        <Button
          variant="primary"
          onClick={isRunning ? onPause : onRun}
          aria-label={isRunning ? "pause" : "run"}
          aria-keyshortcuts="F5"
          title="F5"
          disabled={
            (!programLoaded && (!runAssemblesFirst || isAssembling)) ||
            (isHalted && !isRunning) ||
            (blocked && !isRunning)
          }
        >
          <span>{isRunning ? "pause" : "run"}</span>
          <Shortcut keys="F5" />
        </Button>
        <Button
          variant="secondary"
          onClick={onStep}
          aria-label="step"
          aria-keyshortcuts="F10"
          title="F10"
          disabled={!programLoaded || isRunning || isHalted || blocked}
        >
          <span>step</span>
          <Shortcut keys="F10" />
        </Button>
        {onStepBack && (
          <Button
            variant="secondary"
            onClick={onStepBack}
            aria-label="back"
            aria-keyshortcuts="Shift+F10"
            title="Shift+F10"
            disabled={!programLoaded || isRunning || !canStepBack || blocked}
          >
            <span>back</span>
            <Shortcut keys="Shift+F10" />
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onReset}
          aria-label="reset"
          aria-keyshortcuts="Shift+F5"
          title="Shift+F5"
        >
          <span>reset</span>
          <Shortcut keys="Shift+F5" />
        </Button>

        <div className="controls-spacer flex-1" />

        {stepCount != null && stepCount > 0 && (
          <span
            key={stepCount}
            className="hidden sm:inline text-[10px] text-[var(--text-secondary)] font-mono anim-step-pop"
            role="status"
            aria-label={`${stepCount} instructions executed`}
          >
            {stepCount.toLocaleString()} steps
          </span>
        )}

        {isHalted && !error && (
          <span
            className="hidden sm:inline-flex items-center gap-2 font-sans text-xs tracking-wide text-[var(--text-secondary)]"
            role="status"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            halted
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          // Keyed by the message so a NEW error replays the ~200ms decaying
          // shake (the instrument buzzing back at a bad input); under
          // prefers-reduced-motion the class is inert and the danger-colored
          // text alone carries the state.
          key={error}
          // A readable box, not a truncated line: long messages wrap in
          // full view (scrolling only past ~4 lines) instead of hiding
          // behind a hover title.
          className="anim-error-shake min-w-0 max-w-md rounded border px-2.5 py-1.5 text-left"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 45%, transparent)",
            background: "color-mix(in srgb, var(--danger) 8%, transparent)",
          }}
        >
          <p className="max-h-16 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs leading-snug text-[var(--danger)]">
            {error}
          </p>
          {explanation && (
            <p className="mt-0.5 hidden max-h-12 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-snug text-[var(--text-tertiary)] sm:block">
              {explanation.fix}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Shortcut({ keys }: { keys: string }) {
  // Inherit the button's text color via currentColor so the chip reads on
  // both the cyan-filled primaries and the surface-toned secondaries, at full
  // strength so it clears WCAG AA on the filled cyan (quietness comes from
  // the smaller size and the hairline, not from fading the ink). aria-hidden
  // keeps the chip out of the accessible name -- the button's label stays the
  // bare verb and aria-keyshortcuts already carries the key for AT.
  return (
    <kbd
      aria-hidden="true"
      className="hidden sm:inline-block text-[10px] font-mono leading-none border border-current rounded px-1 py-[2px]"
    >
      {keys}
    </kbd>
  );
}
