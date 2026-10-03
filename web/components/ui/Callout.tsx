"use client";

import type { ReactNode } from "react";

export type CalloutType = "note" | "warning" | "pitfall" | "prereq";

export interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
  /** Replaces the variant's band label, for a box with its own job. */
  label?: string;
  className?: string;
}

// color-mix tints each status color, so no variant needs a second token or a
// hardcoded color. Body text stays on --text-secondary so it passes WCAG AA
// contrast in every theme.
const BORDER: Record<CalloutType, string> = {
  note: "border-[color-mix(in_srgb,var(--cyan)_45%,transparent)]",
  warning: "border-[color-mix(in_srgb,var(--warning)_45%,transparent)]",
  pitfall: "border-[color-mix(in_srgb,var(--danger)_45%,transparent)]",
  prereq: "border-[color-mix(in_srgb,var(--success)_45%,transparent)]",
};

const BAND: Record<CalloutType, string> = {
  note: "bg-[color-mix(in_srgb,var(--cyan)_10%,transparent)] text-[var(--cyan)]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
  pitfall: "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]",
  prereq: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
};

const LABEL: Record<CalloutType, string> = {
  note: "note",
  warning: "warning",
  pitfall: "pitfall",
  prereq: "prerequisite",
};

/**
 * The boxed note the reference and the lessons share. It renders React
 * children only, never an HTML string, so content cannot inject markup.
 */
export function Callout({ type, children, label, className = "" }: CalloutProps) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-control)] border ${BORDER[type]} ${className}`}
    >
      <p
        className={`m-0 px-4 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] ${BAND[type]}`}
      >
        {label ?? LABEL[type]}
      </p>
      <div className="px-4 py-3 font-sans text-[14px] leading-[1.65] text-[var(--text-secondary)]">
        {children}
      </div>
    </div>
  );
}
