"use client";

/**
 * The one feedback surface every interactive block renders after a
 * submission: success shows the author's explanation, failure shows the
 * hint (or a generic retry line) and never the explanation, so a wrong
 * attempt cannot read its way to the answer. Shared across the quiz,
 * blanks, and prediction blocks so the three grade with one look.
 */

import type { JSX } from "react";

export function FeedbackAlert({
  isCorrect,
  explanation,
  hint,
}: {
  /** Whether the student's submission passed the block's check. */
  isCorrect: boolean;
  /** Rendered only after a correct attempt. */
  explanation: string;
  /** Optional guidance rendered on a failed attempt. */
  hint?: string;
}): JSX.Element {
  return (
    <div
      role="status"
      className={`w-full rounded-[var(--radius-control)] border p-4 text-[14px] leading-relaxed transition-colors ${
        isCorrect
          ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)]"
          : "border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)]"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${
            isCorrect ? "bg-[var(--success)]" : "bg-[var(--amber)]"
          }`}
        />
        <strong
          className={`font-mono text-[12px] font-bold uppercase tracking-wider ${
            isCorrect ? "text-[var(--success)]" : "text-[var(--amber)]"
          }`}
        >
          {isCorrect ? "Correct" : "Hint"}
        </strong>
      </div>
      <p className="mt-1 text-[var(--text-secondary)]">
        {isCorrect ? explanation : (hint ?? "That is not it. Re-read the question and check each option against what the instruction actually does.")}
      </p>
    </div>
  );
}
