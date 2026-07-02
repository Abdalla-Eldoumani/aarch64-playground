"use client";

/**
 * The single-exercise layout: the prompt, an acceptance-criteria summary, the
 * shared embeddable editor in checker chrome, and a pass/fail result region.
 *
 * Reuse, no fork: the prompt renders ONLY through the single sanitizing
 * LessonMarkdown (no second Markdown path, no raw-HTML injection), and the
 * editor is the one EmbeddablePlayground in `chrome="checker"`, never a copy.
 * The Check button fires `onCheck(snapshot)`; the handler runs `checkExercise`
 * against the snapshot and the LIVE student source (read through the embed ref),
 * so structural checks see what the student actually wrote. A passing check
 * marks the exercise solved once.
 *
 * No answer leak: the criteria summary describes the SHAPE of each check (no
 * expected values); the fail panel shows expected-vs-actual as feedback but the
 * view never holds or renders a reference solution. An author/student stdin is
 * bounded by validateStdin before it reaches the embed.
 */

import { useRef, useState, type JSX, type ReactNode } from "react";
import Link from "next/link";
import { buildShareHash } from "@/lib/share";
import type {
  Exercise,
  ResultAssertion,
  StructuralAssertion,
} from "@/lib/exercise-schema";
import { checkExercise, type CheckResult } from "@/lib/exercise-checker";
import { markSolved } from "@/lib/solved-state";
import { validateStdin } from "@/lib/upload-guard";
import { LessonMarkdown } from "@/components/LessonMarkdown";
import { Callout } from "@/components/Callout";
import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
  type EmbeddableState,
} from "@/components/EmbeddablePlayground";

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
 * the expected value, so the criteria summary cannot leak the answer.
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
 * as "computes the result" without naming the forbidden value, so the summary
 * and the fail panel never reveal the hardcoded answer.
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

const PANEL_BASE =
  "rounded-[var(--radius-card)] border-l-4 px-4 py-3 text-[var(--text-primary)]";
const PASS_PANEL = `${PANEL_BASE} border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_14%,transparent)]`;
const FAIL_PANEL = `${PANEL_BASE} border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]`;
const PANEL_LABEL = "mb-1 font-sans text-[12px] font-semibold uppercase tracking-wide";

export function ExerciseView({ exercise }: { exercise: Exercise }): JSX.Element {
  const [result, setResult] = useState<CheckResult | null>(null);
  const embedRef = useRef<EmbeddablePlaygroundHandle>(null);

  const handleCheck = (snapshot: EmbeddableState): void => {
    // Read the LIVE editor source so structural checks run on what the student
    // wrote, falling back to the starter before the embed has registered.
    const source = embedRef.current?.getSource() ?? exercise.starter;
    const outcome = checkExercise(exercise.acceptance, snapshot, source);
    setResult(outcome);
    if (outcome.pass) markSolved(exercise.slug);
  };

  const criteria: ReactNode[] = [
    ...exercise.acceptance.results.map(resultCriterion),
    ...(exercise.acceptance.structural ?? []).map(structuralCriterion),
  ];

  const failedResults = result?.results.filter((check) => !check.pass) ?? [];
  const failedStructural = result?.structural.filter((check) => !check.pass) ?? [];

  return (
    <article className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-8 font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl">
        {exercise.title}
      </h1>

      {exercise.variant === "identify-bug" && (
        <div className="my-6">
          <Callout type="warning">
            This program is broken. Find the bug and fix it so the checks pass.
          </Callout>
        </div>
      )}

      <LessonMarkdown markdown={exercise.prompt} />

      <section
        aria-labelledby="acceptance-criteria-heading"
        className="my-8"
      >
        <h2
          id="acceptance-criteria-heading"
          className="mb-3 text-[var(--text-primary)] [font:var(--type-h3)]"
        >
          acceptance criteria
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-6 text-[var(--text-primary)] [font:var(--type-body)]">
          {criteria.map((criterion, index) => (
            <li key={index}>{criterion}</li>
          ))}
        </ul>
      </section>

      <div className="my-6 flex h-[440px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[520px]">
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

      <Link
        href={`/playground${buildShareHash({
          source: exercise.starter,
          args: exercise.args,
          stdin: safeStdin(exercise.stdin),
        })}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] text-[var(--cyan)] [font:var(--type-small)] outline-none hover:underline focus-visible:[box-shadow:var(--ring)]"
      >
        Open in playground
        <span aria-hidden="true">-&gt;</span>
      </Link>

      <div role="status" className="my-6">
        {result && result.pass && (
          <div className={PASS_PANEL}>
            <p className={PANEL_LABEL}>passed</p>
            <p className="font-sans text-[16px] leading-relaxed">all checks passed</p>
          </div>
        )}
        {result && !result.pass && (
          <div className={FAIL_PANEL}>
            <p className={PANEL_LABEL}>not yet</p>
            <p className="mb-2 font-sans text-[16px] leading-relaxed">
              some checks did not pass:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-6 font-sans text-[15px] leading-relaxed">
              {failedResults.map((check, index) => (
                <li key={`result-${index}`}>
                  {resultCriterion(check.assertion)} - expected {check.expected}, got{" "}
                  {check.actual}
                </li>
              ))}
              {failedStructural.map((check, index) => (
                <li key={`structural-${index}`}>{structuralCriterion(check.assertion)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
