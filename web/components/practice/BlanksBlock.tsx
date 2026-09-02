"use client";

/**
 * One fill-in-the-blank question: the code renders around a native input
 * embedded at the `___` marker (the schema guarantees exactly one), and the
 * attempt passes when the trimmed, case-folded input matches any accepted
 * string. Before a wrong answer is corrected the block shows only the
 * author's hint, never the explanation or the accepted answers. `onAttempt`
 * reports each submission upward for the exercise-level solved state.
 */

import { useId, useState, type JSX } from "react";
import { Button } from "@/components/ui/Button";
import { FeedbackAlert } from "@/components/practice/FeedbackAlert";

export function BlanksBlock({
  prompt,
  code,
  blanks,
  explanation,
  hint,
  value,
  onValueChange,
  onAttempt,
}: {
  prompt: string;
  /** The source line with its missing element denoted by the `___` marker. */
  code: string;
  /** Accepted answers; the attempt passes on a match with any of them. */
  blanks: string[];
  /** Rendered only after a correct attempt. */
  explanation: string;
  /** Optional guidance rendered on a failed attempt. */
  hint?: string;
  /** The typed answer when the sheet owns it, so it survives a reload. */
  value?: string;
  /** Fires on every keystroke so the sheet can persist it. */
  onValueChange?: (value: string) => void;
  /** Fires on submission so the parent can track exercise-level progress. */
  onAttempt?: (isCorrect: boolean) => void;
}): JSX.Element {
  const [ownValue, setOwnValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputId = useId();

  // Controlled when the sheet passes `value`, self-owned otherwise.
  const inputVal = value !== undefined ? value : ownValue;
  const setInputVal = (next: string): void => {
    setOwnValue(next);
    if (onValueChange) onValueChange(next);
  };

  const parts = code.split("___");
  const isCorrect = blanks.some(
    (accepted) => accepted.trim().toLowerCase() === inputVal.trim().toLowerCase(),
  );

  const inputTone = submitted
    ? isCorrect
      ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
      : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]"
    : "border-[var(--border-strong)] bg-[var(--bg-sunken)] text-[var(--cyan)] focus:border-[var(--cyan)]";

  return (
    <div className="my-8 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-6">
      <h3 className="mb-4 font-serif text-lg font-semibold text-[var(--text-primary)]">
        Fill in the Blank
      </h3>
      <label
        htmlFor={inputId}
        className="mb-6 block text-[15px] leading-relaxed text-[var(--text-primary)]"
      >
        {prompt}
      </label>

      <div className="mb-6 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-[14px] leading-relaxed text-[var(--text-primary)]">
        {parts[0]}
        <input
          id={inputId}
          type="text"
          value={inputVal}
          onChange={(event) => setInputVal(event.target.value)}
          disabled={submitted}
          className={`inline-block w-20 border-b-2 px-1 py-0.5 text-center font-mono text-[14px] font-bold outline-none transition-colors ${inputTone}`}
        />
        {parts[1]}
      </div>

      <div className="flex flex-col items-start gap-4">
        {!submitted ? (
          <Button
            disabled={inputVal.trim() === ""}
            onClick={() => {
              setSubmitted(true);
              if (onAttempt) onAttempt(isCorrect);
            }}
          >
            check answer
          </Button>
        ) : (
          <div className="flex w-full flex-col items-start gap-5">
            <FeedbackAlert
              isCorrect={isCorrect}
              explanation={explanation}
              hint={hint ?? "Check the spelling and the operand order against the instruction reference."}
            />
            {!isCorrect && (
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setInputVal("");
                }}
              >
                try again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
