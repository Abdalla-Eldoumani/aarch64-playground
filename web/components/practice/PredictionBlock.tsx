"use client";

/**
 * One mental-trace question: a code snippet, a question about the state it
 * leaves behind, and a free-form input graded by trimmed, case-folded
 * string equality against the validated answer. Before a wrong answer is
 * corrected the block shows only the author's hint, never the explanation
 * or the answer. `onAttempt` reports each submission upward for the
 * exercise-level solved state.
 */

import { useId, useState, type JSX } from "react";
import { Button } from "@/components/ui/Button";
import { FeedbackAlert } from "@/components/practice/FeedbackAlert";

export function PredictionBlock({
  code,
  question,
  answer,
  explanation,
  hint,
  onAttempt,
}: {
  /** The snippet the student traces by hand; it is never executed. */
  code: string;
  question: string;
  /** The exact expected value, compared trimmed and case-folded. */
  answer: string;
  /** Rendered only after a correct attempt. */
  explanation: string;
  /** Optional guidance rendered on a failed attempt. */
  hint?: string;
  /** Fires on submission so the parent can track exercise-level progress. */
  onAttempt?: (isCorrect: boolean) => void;
}): JSX.Element {
  const [inputVal, setInputVal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputId = useId();

  const isCorrect = inputVal.trim().toLowerCase() === answer.trim().toLowerCase();

  const inputTone = submitted
    ? isCorrect
      ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] font-medium text-[var(--success)]"
      : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] font-medium text-[var(--danger)]"
    : "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:border-[var(--cyan)]";

  return (
    <div className="my-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-6">
      <h3 className="mb-4 font-serif text-lg font-semibold text-[var(--text-primary)]">
        Mental Trace
      </h3>

      <pre className="mb-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-[14px] leading-relaxed text-[var(--text-primary)]">
        {code}
      </pre>

      <label
        htmlFor={inputId}
        className="mb-4 block text-[15px] font-medium leading-relaxed text-[var(--text-primary)]"
      >
        {question}
      </label>

      <div className="flex flex-col items-start gap-4">
        <input
          id={inputId}
          type="text"
          value={inputVal}
          onChange={(event) => setInputVal(event.target.value)}
          disabled={submitted}
          placeholder="Enter your prediction..."
          className={`w-full max-w-sm rounded-[var(--radius-control)] border px-4 py-2.5 font-mono text-[14px] outline-none transition-colors disabled:opacity-80 ${inputTone}`}
        />

        {!submitted ? (
          <Button
            disabled={inputVal.trim() === ""}
            onClick={() => {
              setSubmitted(true);
              if (onAttempt) onAttempt(isCorrect);
            }}
          >
            Check Answer
          </Button>
        ) : (
          <div className="mt-2 flex w-full flex-col items-start gap-5">
            <FeedbackAlert
              isCorrect={isCorrect}
              explanation={explanation}
              hint={hint ?? "Trace the register values line by line again."}
            />
            {!isCorrect && (
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setInputVal("");
                }}
              >
                Try Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
