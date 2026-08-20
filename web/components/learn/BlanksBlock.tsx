"use client";

/**
 * The isolated interactive renderer for a syntax-completion assertion. Evaluates
 * untrusted student input locally against an array of accepted string answers,
 * managing its own submission lifecycle and retry loop. The source block is
 * split at the designated marker to embed a native input field. On failure,
 * it surfaces the author-provided hint but strictly hides the explanation and
 * accepted answers to prevent answer leaking. State is lifted to the parent
 * only for the shared scoreboard via `onAttempt`.
 */

import { useState, type JSX } from "react";
import { FeedbackAlert } from "./FeedbackAlert";

export function BlanksBlock({
  prompt,
  code,
  blanks,
  explanation,
  hint,
  onAttempt,
}: {
  /** The specific prompt or query to evaluate. */
  prompt: string;
  /** The source block with a missing element denoted by the "___" marker. */
  code: string;
  /** An array of exact string matches; the assertion passes if the input matches any element. */
  blanks: string[];
  /** Rendered ONLY after a successful equivalence check. */
  explanation: string;
  /** Optional fallback text rendered on a failed attempt. */
  hint?: string;
  /** Fires on submission to update the parent's aggregate scoreboard. */
  onAttempt?: (isCorrect: boolean) => void;
}): JSX.Element {
  const [inputVal, setInputVal] = useState("");
  const [submitted, setSubmitted] = useState(false);

  /** Split the bounded source at the designated substitution marker. */
  const parts = code.split("___");

  /**
   * Strict equivalence check: normalizes casing and trims whitespace from the
   * untrusted input, passing if it matches any string in the schema-validated array.
   */
  const isCorrect = blanks.some(
    (b) => b.trim().toLowerCase() === inputVal.trim().toLowerCase()
  );

  return (
    <div className="my-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-6 shadow-sm transition-all">
      <h3 className="mb-4 font-serif text-lg font-semibold text-[var(--text-primary)]">
        Fill in the Blank
      </h3>
      <p className="mb-6 text-[15px] leading-relaxed text-[var(--text-primary)]">
        {prompt}
      </p>

      {/* Renders the source text with a native input field embedded at the marker boundary. */}
      <div className="mb-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-[14px] leading-relaxed text-[var(--text-primary)]">
        {parts[0]}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={submitted}
          className={`inline-block w-20 border-b-2 bg-[var(--bg-sunken)] px-1 py-0.5 text-center font-mono text-[14px] font-bold outline-none transition-colors disabled:bg-transparent ${
            submitted
              ? isCorrect
                ? "border-[var(--success)] text-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)]"
                : "border-[var(--danger)] text-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
              : "border-[var(--border-strong)] text-[var(--cyan)] focus:border-[var(--cyan)]"
          }`}
        />
        {parts[1]}
      </div>

      <div className="flex flex-col items-start gap-4">
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
          <div className="flex w-full flex-col items-start gap-5">
            
            <FeedbackAlert 
              isCorrect={isCorrect} 
              explanation={explanation} 
              hint={hint ?? "Check your syntax carefully and try again."} 
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