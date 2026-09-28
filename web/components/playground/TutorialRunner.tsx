"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TUTORIALS,
  loadProgress,
  saveProgress,
  type ExpectedRegister,
  type Tutorial,
} from "@/lib/content/tutorials";
import { Select } from "@/components/ui/Select";

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
  /** The walk around the interface itself, offered beside the program
   *  tutorials so it can be found again after its first-visit offer. */
  onStartWalkthrough?: () => void;
}

function readRegisterDecimal(name: string, getter?: (n: string) => string | null): number | null {
  if (!getter) return null;
  const raw = getter(name);
  if (raw == null) return null;
  // Accept hex (0x...) or decimal.
  let value: bigint;
  try {
    value = BigInt(raw.trim());
  } catch {
    return null;
  }
  // The getter hands back the whole x register; a w name means its low half.
  return Number(/^w/i.test(name) ? BigInt.asUintN(32, value) : value);
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
  let glyph = "not read";
  if (actual !== null) {
    if (actual === expect.value) {
      cls = "text-[var(--success)]";
      glyph = "ok";
    } else {
      cls = "text-[var(--danger)]";
      glyph = "not yet";
    }
  }
  return (
    <div className="mt-3 text-[12px] rounded border border-[var(--border)] bg-[var(--bg-base)] p-2">
      <span className="text-[var(--text-secondary)]">expect </span>
      <span className="font-mono">{expect.reg}</span>
      <span className="text-[var(--text-secondary)]"> = </span>
      <span className="font-mono">{expect.value}</span>
      {expect.note && (
        <span className="text-[var(--text-secondary)]"> ({expect.note})</span>
      )}
      <span className={`ml-2 ${cls}`}>
        [{glyph}{actual !== null ? `, actual ${actual}` : ""}]
      </span>
    </div>
  );
}

/**
 * A panel that walks the student through a tutorial, one step at a time.
 * Each tutorial backs a real source file under `/examples/cpsc355/`; the
 * runner can fetch it on demand and hand it to the editor with the
 * tutorial's prefilled args/stdin so the student can step alongside the
 * prose.
 *
 * It is not modal. A step says "step, then watch x19", so the run controls
 * and the registers have to stay live under it: the full-screen overlay it
 * used to be caught every tap. It docks to the lower right from sm up and
 * under the phone bar on a phone, clear of the run controls either way.
 */
export function TutorialRunner({
  open,
  onClose,
  onLoadSnippet,
  getRegister,
  onStartWalkthrough,
}: TutorialRunnerProps) {
  const [activeId, setActiveId] = useState<string>(TUTORIALS[0]?.id ?? "");
  const [progress, setProgress] = useState(() => loadProgress());
  const [loadError, setLoadError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Opening moves focus into the panel and closing hands it back, as a
  // dialog does; no trap, since the playground around it stays usable.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

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
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="tutorials"
      // Escape inside the panel closes it; the editor keeps its own Escape.
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-x-2 top-[calc(3rem+var(--safe-top))] z-50 flex max-h-[45dvh] flex-col rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl sm:inset-x-auto sm:bottom-20 sm:right-4 sm:top-auto sm:max-h-[60vh] sm:w-[28rem]"
    >
      <div className="flex flex-1 min-h-0 flex-col">
        {/* Under sm the picker takes a row of its own: in one row with the
            step count and both buttons, close ran past a 320px screen. */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
          <Select
            value={activeId}
            placeholder="tutorial..."
            ariaLabel="tutorial"
            groups={[
              { options: TUTORIALS.map((t) => ({ value: t.id, label: t.title })) },
            ]}
            onSelect={(id) => setActiveId(id)}
            className="basis-full sm:basis-auto min-w-0"
          />
          <span className="whitespace-nowrap text-[11px] [@media(pointer:coarse)]:text-[12px] text-[var(--text-secondary)]">
            step {stepIndex + 1} / {tutorial.steps.length}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={loadSource}
            className="touch-target text-xs rounded bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] text-[var(--text-primary)] px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          >
            load source
          </button>
          <button
            type="button"
            onClick={onClose}
            className="touch-target text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1"
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
            className="touch-target text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 rounded px-2 py-1"
          >
            back
          </button>
          <div className="flex-1" />
          {onStartWalkthrough && (
            <button
              type="button"
              onClick={onStartWalkthrough}
              className="touch-target text-xs text-[var(--cyan)] hover:underline rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              interface walkthrough
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setStep(stepIndex + 1)}
            disabled={stepIndex === tutorial.steps.length - 1}
            className="touch-target text-xs rounded bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] text-[var(--text-primary)] disabled:opacity-40 px-2 py-1"
          >
            next
          </button>
        </div>
      </div>
    </div>
  );
}
