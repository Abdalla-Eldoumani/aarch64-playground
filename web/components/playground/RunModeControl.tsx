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
 * Which surface owns the pane when this program runs: the console's cooked
 * stdin box, or a live terminal session. Rendered only for the examples
 * where both answers are real (EXAMPLE_INTERACTIVE), so every other program
 * keeps the header band it has today and the mode stops being invisible
 * machinery for the ones that have it.
 *
 * Built on ThemeControl's shipped pattern -- one bordered strip with
 * hairline separators rather than two loose pills, `role="group"` with
 * `aria-pressed` per cell, token focus ring. The chosen cell reads cyan
 * because the choice is the student's; nothing here is amber, since
 * nothing is executing yet. Cells are 36px like the band's other
 * controls, widened horizontally instead: the band must not change
 * height as programs load and unload under a student's thumb.
 */
export function RunModeControl({ mode, onChange, disabled = false }: RunModeControlProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      title={disabled ? "a terminal session is running" : undefined}
    >
      <span className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-[var(--text-tertiary)] sm:inline">
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
              className={`inline-flex min-h-[36px] items-center justify-center px-3.5 font-sans text-[12px] font-medium transition-colors focus:outline-none focus-visible:z-10 focus-visible:[box-shadow:var(--ring)] disabled:opacity-50 disabled:pointer-events-none ${
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
