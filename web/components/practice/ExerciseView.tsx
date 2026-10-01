"use client";

/**
 * One coding exercise. Nothing here may leak the answer: the specification
 * names only the shape of each check, a hidden input shows the input and the
 * student's own output but never the expected one, and the view never holds
 * a reference solution.
 */

import { useCallback, useEffect, useId, useRef, useState, type JSX, type ReactNode } from "react";
import { buildShareHash } from "@/lib/playground/share";
import { parseArgs } from "@/lib/playground/args";
import type {
  HiddenCase,
  ResultAssertion,
  StructuralAssertion,
  WriteExercise,
} from "@/lib/content/exercise-schema";
import {
  checkExercise,
  checkHiddenCase,
  type CheckResult,
  type HiddenCaseCheck,
  type StructuralCheck,
} from "@/lib/content/exercise-checker";
import type { EmulatorInstance } from "@/lib/emulator/emulator";
import { markSolved } from "@/lib/playground/solved-state";
import { clearAnswer, readAnswer, saveAnswer } from "@/lib/playground/exercise-answers";
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

/**
 * 500 ms, the playground autosave's own debounce: a typing burst writes
 * once, and a pause is enough to have the work stored.
 */
const ANSWER_SAVE_DEBOUNCE_MS = 500;

const RESTORE_CLASS =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] px-3 font-mono " +
  "text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] outline-none " +
  "transition-colors hover:text-[var(--text-primary)] focus-visible:[box-shadow:var(--ring)]";

/** The buffer this slug reopens with: the saved answer, else the starter. */
function openingSource(slug: string, starter: string): string {
  const saved = readAnswer(slug);
  return saved?.kind === "write" ? saved.source : starter;
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
      return `leaves the right value in ${assertion.reg}`;
    case "exit":
      return "exits with the right code";
    case "stdout":
      return "prints the right output";
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/**
 * A shape-only label for one structural assertion. A forbidden number is
 * described without naming it, so the table and the results panel never
 * reveal the hardcoded answer; an author forbids a string only for a shortcut
 * the prompt already names, so that one is shown. The label claims only what
 * the check tests: an untouched starter holds no literal, so a label that said
 * "computes the result" showed a pass before the student wrote anything.
 */
function structuralCriterion(assertion: StructuralAssertion): ReactNode {
  const where = assertion.in !== undefined && (
    <>
      {" "}
      in <code className={CRITERION_CODE}>{assertion.in}</code>
    </>
  );
  switch (assertion.kind) {
    case "uses-instruction":
      return (
        <>
          uses <code className={CRITERION_CODE}>{assertion.mnemonic}</code>
          {where}
        </>
      );
    case "forbids-instruction":
      return (
        <>
          does not use{" "}
          {assertion.mnemonics.map((mnemonic, index) => (
            <span key={mnemonic}>
              {index > 0 && (index === assertion.mnemonics.length - 1 ? " or " : ", ")}
              <code className={CRITERION_CODE}>{mnemonic}</code>
            </span>
          ))}
          {where}
        </>
      );
    case "forbids-literal":
      // A forbidden number is the answer itself, so it stays unnamed; a
      // forbidden string is a shortcut (a %o format, a banned call) the
      // prompt already names.
      return typeof assertion.value === "number" ? (
        <>does not hardcode the answer{where}</>
      ) : (
        <>
          does not contain <code className={CRITERION_CODE}>{assertion.value}</code>
          {where}
        </>
      );
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/**
 * Why a structural check missed. It reports the shape of the miss, which the
 * student can already see in their own source, so it leaks no answer.
 */
function structuralMiss(check: StructuralCheck): string {
  const { assertion } = check;
  if (check.scopeMissing) return `your program has no ${assertion.in} label`;
  const where = assertion.in === undefined ? "your program" : assertion.in;
  switch (assertion.kind) {
    case "uses-instruction":
      return `${assertion.mnemonic} does not appear in ${where}`;
    case "forbids-instruction":
      return `${check.found ?? assertion.mnemonics[0]} appears in ${where}`;
    case "forbids-literal":
      return `the value ${assertion.value} appears literally in ${where}`;
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

/** The input a hidden case ran on, quoted so a newline reads as \n. */
function caseInput(testCase: HiddenCase): string {
  const parts: string[] = [];
  if (testCase.args) parts.push(`args ${JSON.stringify(testCase.args)}`);
  if (testCase.stdin) parts.push(`input ${JSON.stringify(testCase.stdin)}`);
  return parts.length > 0 ? parts.join(", ") : "no input";
}

/**
 * What went wrong on a hidden case, in terms of the student's own run. The
 * expected output is never shown: the input is, so the student can try it.
 */
function hiddenMiss(check: HiddenCaseCheck): string {
  switch (check.miss) {
    case "assemble":
      return `it does not assemble: ${check.detail}`;
    case "fault":
      return `it stops with an error: ${check.detail}`;
    case "unfinished":
      return "it did not finish: it may loop forever or wait for input that never comes";
    case "stdout":
      return `it prints something else: got ${check.detail}`;
    case "exit":
      return `it exits with ${check.detail}`;
    case "stack":
      return "main returns with sp moved: take the frame down by exactly what you put up";
    case "frame":
      return "it writes above main's frame, over values its caller saved there";
    case null:
      return "";
    default: {
      const exhaustive: never = check.miss;
      return exhaustive;
    }
  }
}

/** Where the hidden cases stand for the current check. */
type HiddenState =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "running" }
  | { status: "failed" }
  | { status: "done"; checks: HiddenCaseCheck[] };

/**
 * One machine for every hidden run on the page, created on the first check.
 * Each assemble resets it, so runs cannot leak into each other, and a single
 * instance means repeated checks never pile up emulator memory.
 */
let hiddenMachine: Promise<EmulatorInstance> | null = null;

function machineForHiddenCases(): Promise<EmulatorInstance> {
  hiddenMachine ??= import("@/lib/emulator/emulator")
    .then((m) => m.loadEmulator())
    .catch((error: unknown) => {
      // A failed load (offline, a stale chunk) must not stick for the page's life.
      hiddenMachine = null;
      throw error;
    });
  return hiddenMachine;
}

async function runHiddenCases(source: string, cases: HiddenCase[]): Promise<HiddenCaseCheck[]> {
  const [machine, { runHeadless }] = await Promise.all([
    machineForHiddenCases(),
    import("@/lib/emulator/headless-run"),
  ]);
  const checks: HiddenCaseCheck[] = [];
  for (const testCase of cases) {
    const outcome = await runHeadless(machine, source, parseArgs(testCase.args ?? ""), testCase.stdin);
    checks.push(checkHiddenCase(testCase, outcome));
  }
  return checks;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  /** The sheet number, e.g. "5.2"; the [slug] page derives it from the sorted order. */
  sheetNumber?: string;
}): JSX.Element {
  const [result, setResult] = useState<CheckResult | null>(null);
  const embedRef = useRef<EmbeddablePlaygroundHandle>(null);
  const specHeadingId = useId();

  // Read once, on this client component's first render. The checker paints no
  // program text before the hub engages, so a buffer the server could not see
  // cannot mismatch the hydrated DOM.
  const [startSource] = useState(() => openingSource(exercise.slug, exercise.starter));
  const lastSavedRef = useRef(startSource);
  const pendingRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: string) => {
      if (next === lastSavedRef.current) return;
      lastSavedRef.current = next;
      // An untouched buffer is nothing to remember, and a student back at the
      // starter has asked for the slot to be empty.
      if (next === exercise.starter) clearAnswer(exercise.slug);
      else saveAnswer(exercise.slug, { kind: "write", source: next });
    },
    [exercise.slug, exercise.starter],
  );

  // Debounced through refs rather than state: a keystroke that re-rendered
  // this view would re-render the prompt and the whole specification table.
  const handleSourceChange = useCallback(
    (next: string) => {
      pendingRef.current = next;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        pendingRef.current = null;
        persist(next);
      }, ANSWER_SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  // Leaving mid-edit must not cost the student the debounce window.
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingRef.current !== null) persist(pendingRef.current);
    },
    [persist],
  );

  const restoreStarter = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingRef.current = null;
    lastSavedRef.current = exercise.starter;
    clearAnswer(exercise.slug);
    embedRef.current?.loadSource(exercise.starter);
  }, [exercise.slug, exercise.starter]);

  const [hidden, setHidden] = useState<HiddenState>({ status: "idle" });
  const hiddenBusyRef = useRef(false);
  const hiddenCases = exercise.hiddenCases ?? [];
  const resultsRef = useRef<HTMLDivElement>(null);
  // Bumped by every check press, so the panel scrolls into view only in
  // answer to one, never on a render of its own.
  const [checkCount, setCheckCount] = useState(0);

  const handleCheck = (snapshot: EmbeddableState): void => {
    // A second press while the hidden cases run would share their machine.
    if (hiddenBusyRef.current) return;
    // Read the LIVE editor source so structural checks run on what the student
    // wrote, falling back to the starter before the embed has registered.
    const source = embedRef.current?.getSource() ?? exercise.starter;
    const outcome = checkExercise(exercise.acceptance, snapshot, source);
    setResult(outcome);
    setCheckCount((n) => n + 1);
    if (hiddenCases.length === 0) {
      if (outcome.pass) markSolved(exercise.slug);
      return;
    }
    // The hidden runs start once the visible one passes: its misses are the
    // ones the student can see and fix first.
    if (!outcome.pass) {
      setHidden({ status: "waiting" });
      return;
    }
    hiddenBusyRef.current = true;
    setHidden({ status: "running" });
    runHiddenCases(source, hiddenCases)
      .then((checks) => {
        setHidden({ status: "done", checks });
        setCheckCount((n) => n + 1);
        if (checks.every((check) => check.pass)) markSolved(exercise.slug);
      })
      .catch(() => setHidden({ status: "failed" }))
      .finally(() => {
        hiddenBusyRef.current = false;
      });
  };

  useEffect(() => {
    if (checkCount === 0) return;
    const panel = resultsRef.current;
    if (panel && typeof panel.scrollIntoView === "function") {
      panel.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [checkCount]);

  const hiddenChecks = hidden.status === "done" ? hidden.checks : [];
  const allChecks = result ? [...result.results, ...result.structural, ...hiddenChecks] : [];
  const passingCount = allChecks.filter((check) => check.pass).length;
  const allPass =
    result !== null &&
    result.pass &&
    (hiddenCases.length === 0 || hiddenChecks.every((check) => check.pass)) &&
    (hiddenCases.length === 0 || hidden.status === "done");

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
          {exercise.args && <SpecRow label="args">{exercise.args}</SpecRow>}
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
          {hiddenCases.length > 0 && (
            <SpecRow label="hidden">
              right output and exit code on {hiddenCases.length} more inputs you do not see
            </SpecRow>
          )}
        </section>

        <p className="font-sans text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          {hiddenCases.length > 0
            ? "We run your program on the input above and on the hidden ones, and compare what it does."
            : "We run your program and compare what it does."}{" "}
          Nothing is matched against a stored solution.
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
            startSource={startSource}
            startArgs={exercise.args}
            startStdin={safeStdin(exercise.stdin)}
            showArgs={Boolean(exercise.args)}
            readOnly={false}
            onSourceChange={handleSourceChange}
            onCheck={handleCheck}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <OpenInPlayground
            href={`/playground${buildShareHash({
              source: exercise.starter,
              args: exercise.args,
              stdin: safeStdin(exercise.stdin),
            })}`}
          />
          {/* The embed's own reset clears the MACHINE; nothing else puts the
              author's starter back once a saved answer reopens with it. */}
          <button type="button" onClick={restoreStarter} className={RESTORE_CLASS}>
            restore starter
          </button>
        </div>

        <div role="status" ref={resultsRef} className="scroll-mb-4">
          {result && (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]">
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  Results
                </span>
                <span className="font-mono text-[11px] uppercase text-[var(--text-tertiary)]">
                  {passingCount} of {allChecks.length} checks passing
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
                    {!check.pass && (
                      <span className="text-[var(--danger)]">: {structuralMiss(check)}</span>
                    )}
                  </span>
                </div>
              ))}
              {hidden.status !== "idle" && hidden.status !== "done" && (
                <p className="border-b border-[var(--border)] px-4 py-2.5 font-mono text-[13px] leading-snug text-[var(--text-secondary)] last:border-b-0">
                  {hidden.status === "running" && `running ${hiddenCases.length} hidden inputs...`}
                  {hidden.status === "waiting" &&
                    `${hiddenCases.length} hidden inputs run once the checks above pass`}
                  {hidden.status === "failed" &&
                    "the hidden inputs could not run: the emulator did not load. Check again."}
                </p>
              )}
              {hiddenChecks.map((check, index) => (
                <div
                  key={`hidden-${index}`}
                  className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-b-0"
                >
                  {/* A flex box, not a line box, so the square centres on the
                      first line of a detail that may wrap to several. */}
                  <span className="mt-[2px] flex">
                    <CheckSquare pass={check.pass} />
                  </span>
                  <span className="min-w-0 break-words font-mono text-[13px] leading-snug text-[var(--text-primary)]">
                    hidden input {index + 1}
                    {!check.pass && (
                      <span className="text-[var(--danger)]">
                        {" "}
                        ({caseInput(hiddenCases[index])}): {hiddenMiss(check)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {allPass && (
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
