"use client";

/**
 * The isolated interactive renderer for a mental tracing assertion. Evaluates
 * untrusted student input locally against the exact string answer, managing
 * its own submission lifecycle and retry loop. On failure, it surfaces the
 * author-provided hint but strictly hides the explanation and answer to
 * prevent answer leaking. State is lifted to the parent only for the shared
 * scoreboard via `onAttempt`.
 */

import { useState, type JSX } from "react";
import { FeedbackAlert } from "./FeedbackAlert";

export function PredictionBlock({
  code,
  question,
  answer,
  explanation,
  hint,
  onAttempt,
}: {
  /** The source snippet to be analyzed. */
  code: string;
  /** The specific state or output to predict. */
  question: string;
  /** The exact string match required to pass. */
  answer: string;
  /** Rendered ONLY after a successful equivalence check. */
  explanation: string;
  /** Optional fallback text rendered on a failed attempt. */
  hint?: string;
  /** Fires on submission to update the parent's aggregate scoreboard. */
  onAttempt?: (isCorrect: boolean) => void;
}): JSX.Element {
  const [inputVal, setInputVal] = useState("");
  const [submitted, setSubmitted] = useState(false);

  /**
   * Strict equivalence check: normalizes casing and trims whitespace from both
   * the untrusted input and the schema-validated answer before comparison.
   */
  const isCorrect = inputVal.trim().toLowerCase() === answer.trim().toLowerCase();

  return (
    <div className="my-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-6 shadow-sm transition-all">
      <h3 className="mb-4 font-serif text-lg font-semibold text-[var(--text-primary)]">
        Mental Trace
      </h3>
      
      <pre className="mb-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-[14px] leading-relaxed text-[var(--text-primary)]">
        {code}
      </pre>

      <p className="mb-4 text-[15px] leading-relaxed text-[var(--text-primary)] font-medium">
        {question}
      </p>

      <div className="flex flex-col items-start gap-4">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={submitted}
          placeholder="Enter your prediction..."
          className={`w-full max-w-sm rounded-[var(--radius-control)] border bg-[var(--bg-elevated)] px-4 py-2.5 font-mono text-[14px] outline-none transition-colors disabled:opacity-80 ${
            submitted
              ? isCorrect
                ? "border-[var(--success)] text-[var(--success)] font-medium bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
                : "border-[var(--danger)] text-[var(--danger)] font-medium bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
              : "border-[var(--border-strong)] text-[var(--text-primary)] focus:border-[var(--cyan)]"
          }`}
        />

        {!submitted ? (
          <button
            disabled={inputVal.trim() === ""}
            onClick={() => {
              setSubmitted(true);
              if (onAttempt) onAttempt(isCorrect);
            }}
            className="rounded-[var(--radius-control)] bg-[var(--cyan)] px-6 py-2.5 text-[14px] font-semibold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-sm"
          >
            Check Answer
          </button>
        ) : (
          <div className="flex w-full flex-col items-start gap-5 mt-2">
            
            <FeedbackAlert 
              isCorrect={isCorrect} 
              explanation={explanation} 
              hint={hint ?? "Trace the register values line by line again."} 
            />

            {!isCorrect && (
              <button
                onClick={() => {
                  setSubmitted(false);
                  setInputVal("");
                }}
                className="rounded-[var(--radius-control)] bg-[var(--cyan)] px-6 py-2.5 text-[14px] font-semibold text-black transition-all hover:opacity-90 shadow-sm"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}