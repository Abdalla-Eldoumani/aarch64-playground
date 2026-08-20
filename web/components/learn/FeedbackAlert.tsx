"use client";

/**
 * A reusable, theme-aware feedback surface for interactive assertions.
 * Renders conditionally styled alerts (success/green or hint/amber) based on
 * the user's attempt status. Designed to be shared across all assessment block types
 * to maintain a consistent UI and eliminate code duplication.
 */

import type { JSX } from "react";

export function FeedbackAlert({
  isCorrect,
  explanation,
  hint,
}: {
  /** Whether the student's submission passed the equivalence check. */
  isCorrect: boolean;
  /** The detailed context rendered ONLY after a successful attempt. */
  explanation: string;
  /** Optional fallback guidance rendered on a failed attempt. */
  hint?: string;
}): JSX.Element {
  return (
    <div
      className={`w-full rounded-[var(--radius-control)] border p-4 text-[14px] leading-relaxed transition-all ${
        isCorrect
          ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--text-primary)]"
          : "border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] text-[var(--text-primary)]"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isCorrect ? "bg-[var(--success)]" : "bg-[var(--amber)]"
          }`}
        />
        <strong
          className={`font-mono text-[12px] uppercase tracking-wider font-bold ${
            isCorrect ? "text-[var(--success)]" : "text-[var(--amber)]"
          }`}
        >
          {isCorrect ? "Note:" : "Hint:"}
        </strong>
      </div>
      <p className="mt-1 text-[var(--text-secondary)]">
        {isCorrect ? explanation : (hint ?? "Review the concepts and try again.")}
      </p>
    </div>
  );
}