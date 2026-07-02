"use client";

interface LectureBarProps {
  onStep: () => void;
  onReset: () => void;
  stepCount: number;
  isHalted: boolean;
  /** False until a successful assemble; stepping has nothing to execute. */
  programLoaded: boolean;
}

/**
 * Back-row-visible Step + Reset bar that renders only while lecture
 * mode is active. Two large buttons split the width 50/50; the step
 * button re-fires its pop animation each time `stepCount` changes via
 * a React key, and goes disabled while no program is loaded or once it
 * halts, so an instructor can't click into a no-op state.
 */
export function LectureBar({ onStep, onReset, stepCount, isHalted, programLoaded }: LectureBarProps) {
  return (
    <div className="flex w-full border-t border-[var(--border)] bg-[var(--bg-sunken)]" aria-label="lecture controls">
      <button
        key={stepCount}
        type="button"
        onClick={onStep}
        disabled={!programLoaded || isHalted}
        className="anim-step-pop flex-1 h-16 text-[22px] font-sans font-semibold border-r border-[var(--border)] bg-[var(--cyan)] text-[var(--on-cyan)] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
        aria-label="step"
      >
        step
      </button>
      <button
        type="button"
        onClick={onReset}
        className="flex-1 h-16 text-[22px] font-sans font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-base)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        aria-label="reset"
      >
        reset
      </button>
    </div>
  );
}
