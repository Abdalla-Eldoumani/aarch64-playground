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
   *  workspace first and starts the session itself. Only run is affected (step
   *  and back still need a loaded program), and an assemble already in flight
   *  still disables it, so one press cannot start two. */
  runAssemblesFirst?: boolean;
  /** True while the program sits at a blocked read waiting for stdin. Run,
   *  step, and back cannot make progress past the read (the machine just
   *  re-blocks), so they disable; assemble and reset stay live because both
   *  genuinely escape the wait by starting over. */
  blocked?: boolean;
  error: string | null;
  stepCount?: number;
  /** The phone row: five buttons sharing the width, no key chips, and no
   *  step counter or halted chip, which the phone's status line carries. The
   *  phone layout pads the safe area itself. */
  compact?: boolean;
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
  compact = false,
}: ControlsProps) {
  // The step counter uses a key tied to the count so the scale-up animation
  // restarts each step without extra effects. The visible 44px controls are
  // the obvious path; the page owns the keyboard shortcuts (a single window
  // listener), so these buttons advertise them via aria-keyshortcuts without
  // binding any keys themselves.

  // The explainer adds a cause and a fix beside the raw error string, so a
  // first failed program says what to do next.
  const explanation = error ? explainError(error) : null;

  // On a phone the five buttons share the row, assemble a little wider for
  // its longer word, so all five fit a 320px screen with nothing to scroll.
  const share = (weight: string) => (compact ? `${weight} min-w-0 !px-1 !text-[13px]` : undefined);

  return (
    <div
      style={compact ? undefined : { paddingBottom: "calc(0.5rem + var(--safe-bottom))" }}
      className={
        compact
          ? "flex flex-col gap-1.5 px-2 py-1 border-t border-[var(--border)] bg-[var(--bg-sunken)]"
          : "flex flex-col gap-1.5 px-2 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)] sm:flex-row sm:items-center sm:gap-2 sm:px-4"
      }
    >
      {/* The assemble error is its own row under the buttons on a phone and
          sits inline beside them from sm up, where this row dissolves and
          every control is a direct child of the outer one. */}
      <div className={compact ? "flex items-center gap-1" : "flex items-center gap-1.5 sm:contents"}>
        <Button
          variant="primary"
          onClick={onAssemble}
          disabled={isAssembling}
          aria-label="assemble"
          data-walkthrough="assemble"
          aria-busy={isAssembling}
          aria-keyshortcuts="F6"
          title="F6"
          className={share("flex-[1.4]")}
        >
          <span>{isAssembling ? "loading…" : "assemble"}</span>
          {!compact && <Shortcut keys="F6" />}
        </Button>
        <Button
          variant="primary"
          onClick={isRunning ? onPause : onRun}
          aria-label={isRunning ? "pause" : "run"}
          data-walkthrough="run"
          aria-keyshortcuts="F5"
          title="F5"
          className={share("flex-1")}
          disabled={
            (!programLoaded && (!runAssemblesFirst || isAssembling)) ||
            (isHalted && !isRunning) ||
            (blocked && !isRunning)
          }
        >
          <span>{isRunning ? "pause" : "run"}</span>
          {!compact && <Shortcut keys="F5" />}
        </Button>
        <Button
          variant="secondary"
          onClick={onStep}
          aria-label="step"
          data-walkthrough="step"
          aria-keyshortcuts="F10"
          title="F10"
          className={share("flex-1")}
          disabled={!programLoaded || isRunning || isHalted || blocked}
        >
          <span>step</span>
          {!compact && <Shortcut keys="F10" />}
        </Button>
        {onStepBack && (
          <Button
            variant="secondary"
            onClick={onStepBack}
            aria-label="back"
            aria-keyshortcuts="Shift+F10"
            title="Shift+F10"
            className={share("flex-1")}
            disabled={!programLoaded || isRunning || !canStepBack || blocked}
          >
            <span>back</span>
            {!compact && <Shortcut keys="Shift+F10" />}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onReset}
          aria-label="reset"
          aria-keyshortcuts="Shift+F5"
          title="Shift+F5"
          className={share("flex-1")}
        >
          <span>reset</span>
          {!compact && <Shortcut keys="Shift+F5" />}
        </Button>

        {!compact && <div className="flex-1" />}

        {!compact && stepCount != null && stepCount > 0 && (
          <span
            key={stepCount}
            className="hidden sm:inline text-[10px] text-[var(--text-secondary)] font-mono anim-step-pop"
            role="status"
            aria-label={`${stepCount} ${stepCount === 1 ? "instruction" : "instructions"} executed`}
          >
            {stepCount.toLocaleString()} {stepCount === 1 ? "step" : "steps"}
          </span>
        )}

        {!compact && isHalted && !error && (
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
          // shake; under prefers-reduced-motion the class is inert and the
          // danger-colored text alone carries the state.
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
  // Hidden on a touch screen, which has no F keys to press. Inherit the
  // button's text color via currentColor so the chip reads on both
  // the cyan-filled primaries and the surface-toned secondaries, at full
  // strength so it clears WCAG AA on the filled cyan. CSS draws the key from
  // data-keys: written as text, it made the visible label "assemble F6"
  // against the name "assemble", which fails label-in-name even with the chip
  // aria-hidden. aria-keyshortcuts carries the key for AT.
  return (
    <kbd
      aria-hidden="true"
      data-keys={keys}
      className="hidden sm:inline-block [@media(pointer:coarse)]:hidden text-[10px] font-mono leading-none border border-current rounded px-1 py-[2px] after:content-[attr(data-keys)]"
    />
  );
}
