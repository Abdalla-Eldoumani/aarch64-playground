"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TUTORIALS,
  loadProgress,
  saveProgress,
  type Tutorial,
} from "@/lib/tutorials";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface TutorialRunnerProps {
  open: boolean;
  onClose: () => void;
  onLoadSnippet: (src: string, label: string) => void;
}

/**
 * Modal that walks the student through a tutorial, one step at a time.
 * Each step can optionally inject a source snippet into the editor so
 * the student can assemble and step through that step's worked example
 * without retyping.
 */
export function TutorialRunner({
  open,
  onClose,
  onLoadSnippet,
}: TutorialRunnerProps) {
  const [activeId, setActiveId] = useState<string>(TUTORIALS[0]?.id ?? "");
  const [progress, setProgress] = useState(() => loadProgress());
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);

  useEffect(() => saveProgress(progress), [progress]);

  const tutorial = useMemo<Tutorial | undefined>(
    () => TUTORIALS.find((t) => t.id === activeId),
    [activeId],
  );
  const stepIndex = progress[activeId] ?? 0;
  const step = tutorial?.steps[stepIndex];

  if (!open || !tutorial) return null;

  const setStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(tutorial.steps.length - 1, idx));
    setProgress((p) => ({ ...p, [activeId]: clamped }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
      role="dialog"
      aria-modal="true"
      aria-label="guided tutorial"
      onClick={onClose}
    >
      <div
        ref={ref}
        className="w-full max-w-2xl max-h-[80vh] rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
            aria-label="tutorial"
          >
            {TUTORIALS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[var(--text-secondary)]">
            step {stepIndex + 1} / {tutorial.steps.length}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1"
          >
            close
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 text-sm">
          <p className="text-[11px] text-[var(--text-secondary)] mb-2">
            {tutorial.summary}
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            {step?.title}
          </h3>
          <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {step?.body}
          </p>
          {step?.snippet && (
            <div className="mt-3">
              <pre className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-2 text-[11px] font-mono overflow-auto whitespace-pre">
                {step.snippet}
              </pre>
              <button
                type="button"
                onClick={() => onLoadSnippet(step.snippet!, `${tutorial.title} step ${stepIndex + 1}`)}
                className="mt-2 text-xs rounded bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black text-[var(--text-primary)] px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                load into playground
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setStep(stepIndex - 1)}
            disabled={stepIndex === 0}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 rounded px-2 py-1"
          >
            back
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setStep(stepIndex + 1)}
            disabled={stepIndex === tutorial.steps.length - 1}
            className="text-xs rounded bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black text-[var(--text-primary)] disabled:opacity-40 px-2 py-1"
          >
            next
          </button>
        </div>
      </div>
    </div>
  );
}
