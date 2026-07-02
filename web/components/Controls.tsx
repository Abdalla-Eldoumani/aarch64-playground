"use client";

import { Button } from "@/components/Button";
import { explainError } from "@/lib/error-explain";

interface ControlsProps {
  onAssemble: () => void;
  onStep: () => void;
  onStepBack?: () => void;
  canStepBack?: boolean;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
  isHalted: boolean;
  /** False until a successful assemble, and false again after reset or a
   *  failed one. Run, step, and back have nothing to execute without a
   *  program, so they render disabled instead of silently no-oping. */
  programLoaded: boolean;
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
  isHalted,
  programLoaded,
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
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)]"
    >
      <Button
        variant="primary"
        onClick={onAssemble}
        aria-label="assemble"
        aria-keyshortcuts="F6"
        title="F6"
      >
        <span>assemble</span>
        <Shortcut keys="F6" />
      </Button>
      <Button
        variant="primary"
        onClick={isRunning ? onPause : onRun}
        aria-label={isRunning ? "pause" : "run"}
        aria-keyshortcuts="F5"
        title="F5"
        disabled={!programLoaded || (isHalted && !isRunning)}
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
        disabled={!programLoaded || isRunning || isHalted}
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
          disabled={!programLoaded || isRunning || !canStepBack}
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

      <div className="flex-1" />

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

      {error && (
        <div
          role="alert"
          className="flex flex-col items-end min-w-0 max-w-md text-right"
        >
          <span className="font-sans text-xs text-[var(--danger)] truncate w-full" title={error}>
            {error}
          </span>
          {explanation && (
            <span
              className="hidden sm:block font-sans text-[11px] text-[var(--text-tertiary)] truncate w-full"
              title={explanation.fix}
            >
              {explanation.fix}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Shortcut({ keys }: { keys: string }) {
  // Inherit the button's text color via currentColor so the chip reads on
  // both the cyan-filled primaries and the surface-toned secondaries.
  return (
    <kbd className="hidden sm:inline-block text-[10px] font-mono leading-none border border-current rounded px-1 py-[2px] opacity-70">
      {keys}
    </kbd>
  );
}
