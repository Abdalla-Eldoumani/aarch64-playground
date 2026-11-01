"use client";

/**
 * One draw-the-frame exercise: the program with its pause line marked, and
 * the paused function's frame drawn the way the frames view draws it, with a
 * number to type wherever an offset or the size goes. Check runs the program
 * to the pause on the page's headless machine and marks each field right or
 * wrong; a wrong field shows the exercise's hint, never the number.
 */

import { useId, useRef, useState, type JSX } from "react";
import type { FrameExercise } from "@/lib/content/exercise-schema";
import type { FieldMark, FrameAnswers, FrameMarks } from "@/lib/content/frame-checker";
import { markSolved } from "@/lib/playground/solved-state";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { Button } from "@/components/ui/Button";
import { CheckSquare } from "@/components/ui/CheckSquare";
import { Kicker } from "@/components/ui/Kicker";
import { ScrollingPre } from "@/components/ui/ScrollingPre";
import { KIND_STYLE } from "@/components/panels/frame-styles";

/** The checker and the frame at the pause, loaded on the first check, so
 *  the page's own chunk carries neither. The program never changes, so the
 *  machine runs it once a page. */
async function loadChecker(exercise: FrameExercise) {
  const [{ runToPause, withHeadlessMachine }, { expectedFrame, gradeFrame }] = await Promise.all([
    import("@/lib/emulator/headless-run"),
    import("@/lib/content/frame-checker"),
  ]);
  const paused = await withHeadlessMachine((machine) => runToPause(machine, exercise.program, exercise.pause));
  return { expected: paused && expectedFrame(exercise, paused), gradeFrame };
}

type CheckState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "failed"; why: string }
  | { status: "done"; marks: FrameMarks };

const MARK_WORD: Record<FieldMark, string> = {
  right: "right",
  wrong: "wrong",
  empty: "empty",
  invalid: "not a number",
};

const INPUT_CLASS =
  "min-h-[44px] w-[4.75rem] rounded-[var(--radius-control)] border bg-[var(--bg-elevated)] px-2 text-right " +
  "font-mono text-[16px] text-[var(--text-primary)] outline-none focus-visible:[box-shadow:var(--ring)]";

const HEADING_CLASS =
  "border-b border-[var(--border-strong)] pb-2 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]";

const HINT_CLASS = "mt-1 text-[13px] leading-snug text-[var(--text-secondary)]";

/** What a missed field says: the exercise's own hint, or how to type it. */
function hintFor(mark: FieldMark | null, hint: string): string | null {
  if (mark === "wrong") return hint;
  if (mark === "empty") return "Type a number of bytes here.";
  if (mark === "invalid") return "Type a whole number of bytes, digits only.";
  return null;
}

/** One number field, labelled for a screen reader, its border the mark's colour. */
function NumberField({
  id,
  label,
  value,
  mark,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  mark: FieldMark | null;
  onChange: (value: string) => void;
}): JSX.Element {
  const missed = mark !== null && mark !== "right";
  const tone =
    mark === null ? "border-[var(--border-control)]" : missed ? "border-[var(--danger)]" : "border-[var(--success)]";
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={missed || undefined}
        aria-describedby={missed ? `${id}-hint` : undefined}
        className={`${INPUT_CLASS} ${tone}`}
      />
    </>
  );
}

/** A field's mark: the tick or cross of CheckSquare, never colour alone, and its word where there is room. */
function Mark({ mark }: { mark: FieldMark | null }): JSX.Element {
  if (mark === null) return <span />;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[var(--text-secondary)]">
      <CheckSquare pass={mark === "right"} />
      {/* On a phone the square alone, so the box keeps its width. */}
      <span aria-hidden="true" className="hidden sm:inline">
        {MARK_WORD[mark]}
      </span>
    </span>
  );
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function FrameExerciseView({
  exercise,
  sheetNumber = "5.x",
}: {
  exercise: FrameExercise;
  /** The sheet number, e.g. "5.137"; the [slug] page derives it from the sorted order. */
  sheetNumber?: string;
}): JSX.Element {
  const baseId = useId();
  const [answers, setAnswers] = useState<FrameAnswers>(() => ({
    size: "",
    slots: exercise.slots.map(() => ""),
    savedFp: "",
    savedLr: "",
  }));
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  // Fields typed in since the last check: an old mark beside a new number
  // would be a lie, so theirs are hidden until the next check.
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  const checker = useRef<ReturnType<typeof loadChecker> | null>(null);

  const marks = check.status === "done" ? check.marks : null;
  const markOf = (key: string, mark: FieldMark | undefined): FieldMark | null =>
    mark === undefined || edited.has(key) ? null : mark;
  const fields = [
    { key: "size", mark: markOf("size", marks?.size), hint: exercise.hints.size },
    ...exercise.slots.map((slot, i) => ({ key: `slot-${i}`, mark: markOf(`slot-${i}`, marks?.slots[i]), hint: slot.hint })),
    { key: "lr", mark: markOf("lr", marks?.savedLr), hint: exercise.hints.savedLr },
    { key: "fp", mark: markOf("fp", marks?.savedFp), hint: exercise.hints.savedFp },
  ];
  const field = (key: string) => fields.find((f) => f.key === key) ?? { key, mark: null, hint: "" };
  const right = fields.filter((f) => f.mark === "right").length;

  const edit = (key: string, next: FrameAnswers) => {
    setAnswers(next);
    if (marks && !edited.has(key)) setEdited(new Set(edited).add(key));
  };

  const runCheck = async () => {
    if (check.status === "running") return;
    setCheck({ status: "running" });
    try {
      checker.current ??= loadChecker(exercise);
      const { expected, gradeFrame } = await checker.current;
      if (!expected) {
        setCheck({ status: "failed", why: "the program never reached its pause, so there is no frame to check" });
        return;
      }
      const next = gradeFrame(expected, answers);
      setEdited(new Set());
      setCheck({ status: "done", marks: next });
      if ([next.size, ...next.slots, next.savedFp, next.savedLr].every((mark) => mark === "right")) {
        markSolved(exercise.slug);
      }
    } catch {
      // A failed load is not kept, so the next press tries again.
      checker.current = null;
      setCheck({ status: "failed", why: "the emulator did not load, so nothing was checked. Check again." });
    }
  };

  const hint = (key: string) => {
    const { mark, hint: text } = field(key);
    const words = hintFor(mark, text);
    return words && (
      <p id={`${baseId}-${key}-hint`} className={HINT_CLASS}>
        {words}
      </p>
    );
  };

  /** One box of the frame, its offset field on the left as the frames view puts fp + N. */
  const box = (key: string, label: string, title: string, kind: "saved" | "local", value: string, set: (v: string) => void) => (
    <li key={key} className="mt-[3px]">
      {/* The mark's column is as wide before a check as after, and the same on
          every row, so the boxes line up and nothing moves when the marks come. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_0.875rem] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_7rem]">
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-[var(--text-tertiary)]">
          <span aria-hidden="true">fp +</span>
          <NumberField id={`${baseId}-${key}`} label={label} value={value} mark={field(key).mark} onChange={set} />
        </span>
        <div className={`break-words px-2 py-[3px] text-[13px] font-medium leading-snug ${KIND_STYLE[kind]}`}>{title}</div>
        <Mark mark={field(key).mark} />
      </div>
      {hint(key)}
    </li>
  );

  const lines = exercise.program.replace(/\n$/, "").split("\n");
  const numberWidth = String(lines.length).length;

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-5">
        <Kicker number={sheetNumber} title="exercise" />
        <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl">
          {exercise.title}
        </h1>
        <LessonMarkdown markdown={exercise.prompt} />
      </div>

      <section aria-labelledby={`${baseId}-program`} className="mt-8">
        <h2 id={`${baseId}-program`} className={HEADING_CLASS}>
          the program
        </h2>
        <ScrollingPre
          className="mt-3"
          preClassName="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)]"
        >
          {lines.map((text, i) => {
            const paused = i + 1 === exercise.pause.line;
            return (
              <span
                key={i}
                className={`block pl-2 pr-4 ${paused ? "bg-[color-mix(in_srgb,var(--amber)_15%,var(--bg-sunken))] [box-shadow:inset_3px_0_0_0_var(--amber)]" : ""}`}
              >
                <span aria-hidden="true" className="select-none text-[var(--text-tertiary)]">
                  {`${String(i + 1).padStart(numberWidth, " ")}  `}
                </span>
                {text}
                {paused && <span className="sr-only"> (paused before this line)</span>}
              </span>
            );
          })}
        </ScrollingPre>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          Paused before line {exercise.pause.line} runs
          {exercise.pause.hit > 1 && `, the ${ordinal(exercise.pause.hit)} time the program gets there`}.
        </p>
      </section>

      <section aria-labelledby={`${baseId}-frame`} className="mt-8 font-sans">
        <h2 id={`${baseId}-frame`} className={HEADING_CLASS}>
          the frame at the pause
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-primary)]">
          <span aria-hidden="true">frame size</span>
          <NumberField
            id={`${baseId}-size`}
            label="frame size in bytes"
            value={answers.size}
            mark={field("size").mark}
            onChange={(value) => edit("size", { ...answers, size: value })}
          />
          <span aria-hidden="true">bytes</span>
          <Mark mark={field("size").mark} />
        </div>
        {hint("size")}
        <ul aria-label="the frame, high address first" className="mt-3 max-w-lg">
          {exercise.slots
            .map((slot, i) =>
              box(`slot-${i}`, `offset of ${slot.name} from fp, in bytes`, slot.name, "local", answers.slots[i], (value) =>
                edit(`slot-${i}`, { ...answers, slots: answers.slots.map((old, k) => (k === i ? value : old)) }),
              ),
            )
            .reverse()}
          {box("lr", "offset of the saved lr from fp, in bytes", "saved lr (x30)", "saved", answers.savedLr, (value) =>
            edit("lr", { ...answers, savedLr: value }),
          )}
          {box("fp", "offset of the saved fp from fp, in bytes", "saved fp (x29)", "saved", answers.savedFp, (value) =>
            edit("fp", { ...answers, savedFp: value }),
          )}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button onClick={runCheck} disabled={check.status === "running"}>
            check
          </Button>
          <p role="status" className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {check.status === "running" && "running the program to the pause"}
            {check.status === "failed" && check.why}
            {check.status === "done" &&
              (right === fields.length ? `all ${fields.length} right` : `${right} of ${fields.length} right`)}
          </p>
        </div>
      </section>
    </article>
  );
}
