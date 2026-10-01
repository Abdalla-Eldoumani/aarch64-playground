"use client";

import type { LaunchMode } from "@/lib/playground/playground-handoff";

// The visible label stays the bare surface name; the accessible name spells
// out the sentence the control makes ("run in the terminal") and contains
// the visible word, so speech input still matches what is on screen.
const OPTIONS: { value: LaunchMode; label: string }[] = [
  { value: "console", label: "console" },
  { value: "terminal", label: "terminal" },
];

interface RunModeControlProps {
  mode: LaunchMode;
  onChange: (next: LaunchMode) => void;
  /** A foreground session owns the pane: flipping the mode under it would
   *  move the console's ownership badge mid-run. */
  disabled?: boolean;
}

/**
 * Shown only for examples that work both ways (EXAMPLE_INTERACTIVE). The chosen
 * cell is cyan, not amber, since nothing is running yet; cells stay 36px so the
 * band keeps its height as programs load and unload.
 */
export function RunModeControl({ mode, onChange, disabled = false }: RunModeControlProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      title={disabled ? "a terminal session is running" : undefined}
    >
      <span className="hidden font-mono text-[12px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-[var(--text-tertiary)] sm:inline">
        run in
      </span>
      <div
        role="group"
        aria-label="run in"
        className="inline-flex items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
      >
        {OPTIONS.map(({ value, label }, index) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-label={`run in the ${label}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(value)}
              className={`touch-target inline-flex min-h-[36px] items-center justify-center px-3.5 font-sans text-[12px] font-medium transition-colors focus:outline-none focus-visible:z-10 focus-visible:[box-shadow:var(--ring)] disabled:opacity-50 disabled:pointer-events-none ${
                index > 0 ? "border-l border-[var(--border)]" : ""
              } ${
                active
                  ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
