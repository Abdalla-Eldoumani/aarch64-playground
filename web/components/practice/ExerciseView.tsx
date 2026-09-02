"use client";

/**
 * The single-exercise layout, as a two-column datasheet: a 420px statement
 * column (kicker, serif title, prompt, SPECIFICATION table, behavior-check
 * disclaimer) beside a work column (the shared embeddable editor in checker
 * chrome and a RESULTS panel). Below `lg` the columns stack: statement, then
 * editor, then results.
 *
 * Reuse, no fork: the prompt renders ONLY through the single sanitizing
 * LessonMarkdown (no second Markdown path, no raw-HTML injection), and the
 * editor is the one EmbeddablePlayground in `chrome="checker"`, never a copy.
 * The Check button fires `onCheck(snapshot)`; the handler runs `checkExercise`
 * against the snapshot and the LIVE student source (read through the embed ref),
 * so structural checks see what the student actually wrote. A passing check
 * marks the exercise solved once.
 *
 * No answer leak: the SPECIFICATION table describes the SHAPE of each check (no
 * expected values); the RESULTS panel shows expected-vs-actual as feedback but
 * the view never holds or renders a reference solution. An author/student stdin
 * is bounded by validateStdin before it reaches the embed.
 */

import { useId, useRef, useState, type JSX, type ReactNode } from "react";
import { buildShareHash } from "@/lib/playground/share";
import type {
  ResultAssertion,
  StructuralAssertion,
  WriteExercise,
} from "@/lib/content/exercise-schema";
import { checkExercise, type CheckResult } from "@/lib/content/exercise-checker";
import { markSolved } from "@/lib/playground/solved-state";
import { validateStdin } from "@/lib/playground/upload-guard";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { Callout } from "@/components/ui/Callout";
import { Kicker } from "@/components/ui/Kicker";
import { OpenInPlayground } from "@/components/ui/OpenInPlayground";
import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
  type EmbeddableState,
} from "@/components/playground/EmbeddablePlayground";

/**
 * The author/student stdin only when present and within the stdin cap;
 * otherwise undefined, so an oversize input is dropped at this boundary rather
 * than seeded into the embed (mirrors LessonArticle's helper).
 */
function safeStdin(stdin: string | undefined): string | undefined {
  if (stdin === undefined) return undefined;
  return validateStdin(stdin) === null ? stdin : undefined;
}

const CRITERION_CODE =
  "rounded-[var(--radius-control)] bg-[var(--bg-elevated)] px-1 py-0.5 font-mono text-[0.9em] text-[var(--text-primary)]";

/**
 * A shape-only label for one result assertion: it names WHAT is checked, never
 * the expected value, so the specification table cannot leak the answer.
 */
function resultCriterion(assertion: ResultAssertion): ReactNode {
  switch (assertion.kind) {
    case "register":
      return `leaves the expected value in ${assertion.reg}`;
    case "exit":
      return "exits with the expected code";
    case "stdout":
      return "prints the expected output";
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/**
 * A shape-only label for one structural assertion. forbids-literal is described
 * as "computes the result" without naming the forbidden value, so the table
 * and the results panel never reveal the hardcoded answer.
 */
function structuralCriterion(assertion: StructuralAssertion): ReactNode {
  switch (assertion.kind) {
    case "uses-instruction":
      return (
        <>
          uses <code className={CRITERION_CODE}>{assertion.mnemonic}</code>
        </>
      );
    case "forbids-literal":
      return "computes the result (does not hardcode it)";
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/** One SPECIFICATION row: mono label column over a hairline, shape-only value. */
function SpecRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-baseline gap-x-4 border-b border-[var(--border)] py-2.5">
      <span className="w-24 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {label}
      </span>
      <span className="font-mono text-[13px] leading-relaxed text-[var(--text-primary)]">
        {children}
      </span>
    </div>
  );
}

/** The 14px pass/fail square with its ✓/✗ glyph, plus text for screen readers. */
function CheckSquare({ pass }: { pass: boolean }): JSX.Element {
  const tone = pass
    ? "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]"
    : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]";
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border font-mono text-[9px] font-bold leading-none ${tone}`}
    >
      <span aria-hidden="true">{pass ? "✓" : "✗"}</span>
      <span className="sr-only">{pass ? "passed" : "failed"}</span>
    </span>
  );
}

export function ExerciseView({
  exercise,
  sheetNumber = "5.x",
}: {
  /** The emulator-backed coding variants only; interactive variants render through InteractiveExerciseView. */
  exercise: WriteExercise;
  /** Datasheet coordinate, e.g. "5.2"; the [slug] page derives it from the sorted order. */
  sheetNumber?: string;
}): JSX.Element {
  const [result, setResult] = useState<CheckResult | null>(null);
  const embedRef = useRef<EmbeddablePlaygroundHandle>(null);
  const specHeadingId = useId();

  const handleCheck = (snapshot: EmbeddableState): void => {
    // Read the LIVE editor source so structural checks run on what the student
    // wrote, falling back to the starter before the embed has registered.
    const source = embedRef.current?.getSource() ?? exercise.starter;
    const outcome = checkExercise(exercise.acceptance, snapshot, source);
    setResult(outcome);
    if (outcome.pass) markSolved(exercise.slug);
  };

  const allChecks = result ? [...result.results, ...result.structural] : [];
  const passingCount = allChecks.filter((check) => check.pass).length;

  return (
    <article className="mx-auto w-full max-w-screen-xl px-6 py-10 sm:py-12 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12">
      {/* Statement column */}
      <div className="flex flex-col gap-5">
        <Kicker number={sheetNumber} title="exercise" />
        <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl">
          {exercise.title}
        </h1>

        {exercise.variant === "identify-bug" && (
          <Callout type="warning">
            This program is broken. Find the bug and fix it so the checks pass.
          </Callout>
        )}

        <LessonMarkdown markdown={exercise.prompt} />

        <section aria-labelledby={specHeadingId}>
          <h2
            id={specHeadingId}
            className="border-b border-[var(--border-strong)] pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]"
          >
            Specification
          </h2>
          {exercise.args !== undefined && <SpecRow label="args">{exercise.args}</SpecRow>}
          {exercise.stdin !== undefined && (
            <SpecRow label="stdin">
              <span className="whitespace-pre-wrap break-words">{exercise.stdin}</span>
            </SpecRow>
          )}
          {exercise.acceptance.results.map((assertion, index) => (
            <SpecRow key={`result-${index}`} label={assertion.kind}>
              {resultCriterion(assertion)}
            </SpecRow>
          ))}
          {(exercise.acceptance.structural ?? []).map((assertion, index) => (
            <SpecRow key={`structural-${index}`} label="source">
              {structuralCriterion(assertion)}
            </SpecRow>
          ))}
        </section>

        <p className="font-sans text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Checked by running your program against expected behavior, never by matching a stored
          solution.
        </p>
      </div>

      {/* Work column */}
      <div className="mt-8 flex flex-col gap-4 lg:mt-0">
        {/* Fixed frame at every breakpoint (no shift as the editor loads); the
            embed's container-driven layout gives the editor the full column
            measure above a registers | console split. */}
        <div className="embed-frame flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[560px] lg:h-[640px] xl:h-[720px]">
          <EmbeddablePlayground
            ref={embedRef}
            chrome="checker"
            startSource={exercise.starter}
            startArgs={exercise.args}
            startStdin={safeStdin(exercise.stdin)}
            readOnly={false}
            onCheck={handleCheck}
          />
        </div>

        <OpenInPlayground
          href={`/playground${buildShareHash({
            source: exercise.starter,
            args: exercise.args,
            stdin: safeStdin(exercise.stdin),
          })}`}
          className="self-start"
        />

        <div role="status">
          {result && (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]">
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Results
                </span>
                <span className="font-mono text-[11px] uppercase text-[var(--text-tertiary)]">
                  {passingCount} of {allChecks.length} passing
                </span>
              </div>
              {result.results.map((check, index) => (
                <div
                  key={`result-${index}`}
                  className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-b-0"
                >
                  <CheckSquare pass={check.pass} />
                  <span className="font-mono text-[13px] leading-snug text-[var(--text-primary)]">
                    {resultCriterion(check.assertion)}
                    {!check.pass && (
                      <span className="text-[var(--danger)]">
                        {" "}
                        (expected {check.expected}, got {check.actual})
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {result.structural.map((check, index) => (
                <div
                  key={`structural-${index}`}
                  className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-b-0"
                >
                  <CheckSquare pass={check.pass} />
                  <span className="font-mono text-[13px] leading-snug text-[var(--text-primary)]">
                    {structuralCriterion(check.assertion)}
                  </span>
                </div>
              ))}
              {result.pass && (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <CheckSquare pass />
                  <span className="font-mono text-[13px] leading-snug text-[var(--text-primary)]">
                    {result.summary}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
