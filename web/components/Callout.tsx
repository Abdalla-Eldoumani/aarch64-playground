"use client";

import type { ReactNode } from "react";

export type CalloutType = "note" | "warning" | "pitfall";

export interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
  className?: string;
}

// Each variant's field is driven by its semantic token: the 4px rule and a faint
// tint of the same token (color-mix keeps it readable and theme-aware without a
// second token or any hardcoded color). Body and label stay on `--text-primary`
// so contrast clears WCAG AA in every theme.
const FIELD: Record<CalloutType, string> = {
  note: "border-[var(--cyan-dim)] bg-[color-mix(in_srgb,var(--cyan-dim)_14%,transparent)]",
  warning: "border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]",
  pitfall: "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]",
};

const LABEL: Record<CalloutType, string> = {
  note: "Note",
  warning: "Warning",
  pitfall: "Pitfall",
};

/**
 * The base callout the reference and lessons draw from. One component, three
 * types: note / warning / pitfall, each reading from its semantic token. Renders
 * caller-supplied React children only (no HTML-string injection).
 */
export function Callout({ type, children, className = "" }: CalloutProps) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border-l-4 px-4 py-3 text-[var(--text-primary)] ${FIELD[type]} ${className}`}
    >
      <p className="mb-1 font-sans text-[12px] font-semibold uppercase tracking-wide">
        {LABEL[type]}
      </p>
      <div className="font-sans text-[16px] leading-relaxed">{children}</div>
    </div>
  );
}
