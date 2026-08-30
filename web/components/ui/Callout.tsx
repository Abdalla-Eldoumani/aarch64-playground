"use client";

import type { ReactNode } from "react";

export type CalloutType = "note" | "warning" | "pitfall" | "prereq";

export interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
  className?: string;
}

// Each variant is driven by its semantic token: a full hairline border at 45%
// of the status color, a header band tinted at 10%, and the label in the
// status ink (color-mix keeps everything readable and theme-aware without a
// second token or any hardcoded color). Body copy stays on --text-secondary
// so contrast clears WCAG AA in every theme.
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
 * The base callout the reference and lessons draw from. One component, four
 * types: note / warning / pitfall / prereq, each reading from its semantic token; a
 * bordered field with a tinted header band carrying the mono status label,
 * the datasheet's warning-box grammar rather than a left-rule aside. Renders
 * caller-supplied React children only (no HTML-string injection).
 */
export function Callout({ type, children, className = "" }: CalloutProps) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-control)] border ${BORDER[type]} ${className}`}
    >
      <p
        className={`m-0 px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${BAND[type]}`}
      >
        {LABEL[type]}
      </p>
      <div className="px-4 py-3 font-sans text-[14px] leading-[1.65] text-[var(--text-secondary)]">
        {children}
      </div>
    </div>
  );
}
