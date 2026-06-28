"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TUTORIALS,
  loadProgress,
  saveProgress,
  type ExpectedRegister,
  type Tutorial,
} from "@/lib/tutorials";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface TutorialRunnerProps {
  open: boolean;
  onClose: () => void;
  onLoadSnippet: (src: string, label: string, args?: string, stdin?: string) => void;
  /**
   * Resolve a register's current decimal value as a string, or null when
   * the runner has no live state. Used to verify each step's optional
   * `expect` clause against what the CPU actually holds.
   */
  getRegister?: (name: string) => string | null;
}

function readRegisterDecimal(name: string, getter?: (n: string) => string | null): number | null {
  if (!getter) return null;
  const raw = getter(name);
  if (raw == null) return null;
  // Accept hex (0x...) or decimal.
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    const big = BigInt(raw);
    return Number.parseInt(big.toString(), 10);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function ExpectedRegisterCheck({
  expect,
  getter,
}: {
  expect: ExpectedRegister;
  getter?: (name: string) => string | null;
}) {
  const actual = readRegisterDecimal(expect.reg, getter);
  let cls = "text-[var(--text-secondary)]";
  let glyph = "?";
  if (actual !== null) {
    if (actual === expect.value) {
      cls = "text-[var(--success)]";
      glyph = "OK";
    } else {
      cls = "text-[var(--danger)]";
      glyph = "no";
    }
  }
  return (
    <div className="mt-3 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)] p-2">
      <span className="text-[var(--text-secondary)]">expect </span>
      <span className="font-mono">{expect.reg}</span>
      <span className="text-[var(--text-secondary)]"> = </span>
      <span className="font-mono">{expect.value}</span>
      {expect.note && (
        <span className="text-[var(--text-secondary)]"> -- {expect.note}</span>
      )}
      <span className={`ml-2 ${cls}`}>
        [{glyph}{actual !== null ? `, actual ${actual}` : ""}]
      </span>
    </div>
  );
}

/**
 * Modal that walks the student through a tutorial, one step at a time.
 * Each tutorial backs a real source file under `/examples/cpsc355/`; the
 * runner can fetch it on demand and hand it to the editor with the
 * tutorial's prefilled args/stdin so the student can step alongside the
 * prose.
 */
export function TutorialRunner({
  open,
  onClose,
  onLoadSnippet,
  getRegister,
}: TutorialRunnerProps) {
  const [activeId, setActiveId] = useState<string>(TUTORIALS[0]?.id ?? "");
  const [progress, setProgress] = useState(() => loadProgress());
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const loadSource = async () => {
    setLoadError(null);
    try {
      const res = await fetch(tutorial.sourcePath);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      onLoadSnippet(text, tutorial.title, tutorial.args, tutorial.stdin);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "failed to load tutorial source");
    }
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
        className="w-full max-w-2xl max-h-[80vh] rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
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
            onClick={loadSource}
            className="text-xs rounded bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] text-[var(--text-primary)] px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            load source
          </button>
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
          {loadError && (
            <p className="text-[11px] text-[var(--danger)] mb-2" role="alert">
              {loadError}
            </p>
          )}
          <h3 className="font-serif text-[18px] font-semibold tracking-tight text-[var(--text-primary)] mb-2">
            {step?.title}
          </h3>
          <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {step?.body}
          </p>
          {step?.highlight && (
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
              focus: lines {step.highlight.start}-{step.highlight.end} of the source
            </p>
          )}
          {step?.watchReg && (
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
              watch hint: add{" "}
              <span className="font-mono text-[var(--text-primary)]">{step.watchReg}</span>{" "}
              to the watch panel
            </p>
          )}
          {step?.expect && (
            <ExpectedRegisterCheck expect={step.expect} getter={getRegister} />
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
            className="text-xs rounded bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] text-[var(--text-primary)] disabled:opacity-40 px-2 py-1"
          >
            next
          </button>
        </div>
      </div>
    </div>
  );
}
