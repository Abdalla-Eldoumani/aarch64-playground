"use client";

/**
 * One multiple-choice question, graded locally against the validated
 * correct index. Before a wrong answer is corrected the block shows only
 * the author's hint, never the explanation or the right option, so a
 * student cannot read their way to the answer. `onAttempt` reports each
 * submission upward for the exercise-level solved state.
 */

import { useState, type JSX } from "react";
import { Button } from "@/components/ui/Button";
import { FeedbackAlert } from "@/components/practice/FeedbackAlert";

export function QuizBlock({
  question,
  options,
  correctAnswer,
  explanation,
  hint,
  onAttempt,
}: {
  question: string;
  /** Rendered as selectable answer buttons, in author order. */
  options: string[];
  /** The index within options required to pass. */
  correctAnswer: number;
  /** Rendered only after a correct attempt. */
  explanation: string;
  /** Optional guidance rendered on a failed attempt. */
  hint?: string;
  /** Fires on submission so the parent can track exercise-level progress. */
  onAttempt?: (isCorrect: boolean) => void;
}): JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selected === correctAnswer;

  return (
    <div className="my-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-6">
      <h3 className="mb-4 font-serif text-lg font-semibold text-[var(--text-primary)]">
        Knowledge Check
      </h3>
      <p className="mb-6 text-[15px] leading-relaxed text-[var(--text-primary)]">{question}</p>

      <div className="flex flex-col gap-3">
        {options.map((opt, i) => {
          const isSelected = selected === i;
          let tone: string;
          if (submitted) {
            if (isCorrect) {
              tone =
                i === correctAnswer
                  ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_15%,transparent)] font-medium text-[var(--success)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-tertiary)] opacity-40";
            } else {
              tone = isSelected
                ? "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] font-medium text-[var(--danger)]"
                : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] opacity-70";
            }
          } else {
            tone = isSelected
              ? "border-[var(--cyan)] bg-[color-mix(in_srgb,var(--cyan)_12%,transparent)] font-medium text-[var(--text-primary)]"
              : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]";
          }

          return (
            <button
              key={i}
              type="button"
              disabled={submitted}
              onClick={() => setSelected(i)}
              aria-pressed={isSelected}
              className={`rounded-[var(--radius-control)] border px-4 py-3 text-left text-[14px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${tone}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <Button
          disabled={selected === null}
          onClick={() => {
            setSubmitted(true);
            if (onAttempt) onAttempt(isCorrect);
          }}
          className="mt-6"
        >
          check answer
        </Button>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-5">
          <FeedbackAlert isCorrect={isCorrect} explanation={explanation} hint={hint} />
          {!isCorrect && (
            <Button
              onClick={() => {
                setSubmitted(false);
                setSelected(null);
              }}
            >
              try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
