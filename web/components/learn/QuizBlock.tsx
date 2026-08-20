"use client";

/**
 * The isolated interactive renderer for a multiple-choice assertion. Evaluates
 * the student's selection locally against the exact index, managing its own
 * submission lifecycle and retry loop. On failure, it surfaces the author-provided
 * hint but strictly hides the explanation and the correct option to prevent
 * answer leaking. State is lifted to the parent only for the shared scoreboard
 * via `onAttempt`.
 */

import { useState, type JSX } from "react";
import { FeedbackAlert } from "./FeedbackAlert";

export function QuizBlock({
  question,
  options,
  correctAnswer,
  explanation,
  hint,
  onAttempt,
}: {
  /** The specific prompt or query to evaluate. */
  question: string;
  /** An array of possible string answers rendered as selectable buttons. */
  options: string[];
  /** The exact index within the options array required to pass. */
  correctAnswer: number;
  /** Rendered ONLY after a successful equivalence check. */
  explanation: string;
  /** Optional fallback text rendered on a failed attempt. */
  hint?: string;
  /** Fires on submission to update the parent's aggregate scoreboard. */
  onAttempt?: (isCorrect: boolean) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Strict equivalence check: compares the untrusted user selection directly
   * against the schema-validated index.
   */
  const isCorrect = selected === correctAnswer;

  return (
    <div className="my-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-6 shadow-sm transition-all">
      <h3 className="mb-4 font-serif text-lg font-semibold text-[var(--text-primary)]">
        Knowledge Check
      </h3>
      <p className="mb-6 text-[15px] leading-relaxed text-[var(--text-primary)]">
        {question}
      </p>
      
      <div className="flex flex-col gap-3">
        {options.map((opt, i) => {
          const isSelected = selected === i;
          let buttonClass =
            "text-left rounded-[var(--radius-control)] border px-4 py-3 text-[14px] transition-all ";
          
          if (submitted) {
            if (isCorrect) {
              if (i === correctAnswer) {
                buttonClass +=
                  "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)] font-medium";
              } else {
                buttonClass += "border-[var(--border)] text-[var(--text-tertiary)] opacity-40 bg-[var(--bg-elevated)]";
              }
            } else {
              if (isSelected) {
                buttonClass +=
                  "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] font-medium";
              } else {
                buttonClass += "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] opacity-70";
              }
            }
          } else {
            buttonClass += isSelected
              ? "border-[var(--cyan)] bg-[color-mix(in_srgb,var(--cyan)_12%,transparent)] text-[var(--text-primary)] font-medium shadow-sm"
              : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-sunken)]";
          }

          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => setSelected(i)}
              className={buttonClass}
            >
              {opt}
            </button>
          );
        })}
      </div>
      
      {!submitted ? (
        <button
          disabled={selected === null}
          onClick={() => {
            setSubmitted(true);
            if (onAttempt) onAttempt(isCorrect);
          }}
          className="mt-6 rounded-[var(--radius-control)] bg-[var(--cyan)] px-6 py-2.5 text-[14px] font-semibold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-sm"
        >
          Check Answer
        </button>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-5">
          
          {/* Deduplicated Feedback Alert */}
          <FeedbackAlert 
            isCorrect={isCorrect} 
            explanation={explanation} 
            hint={hint} 
          />
          
          {!isCorrect && (
            <button
              onClick={() => {
                setSubmitted(false);
                setSelected(null);
              }}
              className="rounded-[var(--radius-control)] bg-[var(--cyan)] px-6 py-2.5 text-[14px] font-semibold text-black transition-all hover:opacity-90 shadow-sm"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}