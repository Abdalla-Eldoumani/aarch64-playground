"use client";

import { useId } from "react";
import { usePersistedFlag } from "@/components/panels/register-panel-settings";
import type { StepGoal } from "@/lib/emulator/emulator-state";

const GOALS: [StepGoal, string][] = [
  ["over", "step over"],
  ["out", "step out"],
  ["cursor", "run to cursor"],
];

/**
 * A frame's step over, step out and run to cursor, in its run row. A
 * one-pane frame (globals.css, `.embed-more`) keeps them behind "more" so the
 * row stays one line, open or shut as the viewer last left it.
 */
export function StepGoals({
  onRunUntil,
  disabled,
  className,
}: {
  onRunUntil: (goal: StepGoal) => void;
  disabled: boolean;
  /** The run row's secondary-button classes. */
  className: string;
}) {
  const [more, setMore] = usePersistedFlag("aarch64-playground:embed-more");
  const id = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setMore(!more)}
        aria-label="more"
        aria-expanded={more}
        aria-controls={id}
        className={`embed-more ${className}`}
      >
        more
      </button>
      <div id={id} className="embed-goals" data-open={more || undefined}>
        {GOALS.map(([goal, label]) => (
          <button
            key={goal}
            type="button"
            onClick={() => onRunUntil(goal)}
            disabled={disabled}
            aria-label={label}
            className={className}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
