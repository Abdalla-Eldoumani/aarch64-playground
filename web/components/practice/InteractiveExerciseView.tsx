"use client";

/**
 * The single-exercise layout for the interactive variants (quiz, prediction,
 * blanks): kicker, serif title, prompt, a progress line, then one graded
 * block per question. Grading happens entirely in the blocks; this view only
 * counts first-time-correct questions and marks the exercise solved (the
 * same solved-state store the index badges read) once every question has
 * been answered correctly.
 *
 * The answers themselves are held here rather than in the blocks, so they
 * can be saved per slug and restored on a later visit. Restoring happens
 * after mount: reading storage during the first render would put a value in
 * the DOM the server render could not have, and hydration would flag it.
 */

import { useCallback, useEffect, useReducer, useState, type JSX } from "react";
import type {
  BlanksExercise,
  PredictionExercise,
  QuizExercise,
} from "@/lib/content/exercise-schema";
import { markSolved } from "@/lib/playground/solved-state";
import { readAnswer, saveAnswer } from "@/lib/playground/exercise-answers";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { Kicker } from "@/components/ui/Kicker";
import { QuizBlock } from "@/components/practice/QuizBlock";
import { PredictionBlock } from "@/components/practice/PredictionBlock";
import { BlanksBlock } from "@/components/practice/BlanksBlock";

export type InteractiveExercise = QuizExercise | PredictionExercise | BlanksExercise;

/** The question count, per variant, so progress and solved-state agree. */
function questionCount(exercise: InteractiveExercise): number {
  switch (exercise.variant) {
    case "quiz":
      return exercise.questions.length;
    case "prediction":
      return exercise.predictions.length;
    case "blanks":
      return exercise.blanks.length;
    default: {
      const exhaustive: never = exercise;
      return exhaustive;
    }
  }
}

/**
 * The answers in flight for this sheet. One field is live per variant: the
 * quiz picks option indices, the other two collect typed text.
 */
interface AnswerDraft {
  picks: (number | null)[];
  typed: string[];
}

const EMPTY_DRAFT: AnswerDraft = { picks: [], typed: [] };

/**
 * A reducer rather than two useState pairs, because the restore below has to
 * run in an effect (storage cannot be read during the first render without
 * diverging from the server's) and a dispatch is what React 19's
 * set-state-in-effect check allows there. Every edit arrives already built,
 * so the reducer itself stays a merge.
 */
function draftReducer(prev: AnswerDraft, edit: Partial<AnswerDraft>): AnswerDraft {
  return { ...prev, ...edit };
}

/** A copy of `values` with `index` set, padded with `filler` where short. */
function withAt<T>(values: T[], index: number, value: T, filler: T): T[] {
  const next = values.slice();
  while (next.length <= index) next.push(filler);
  next[index] = value;
  return next;
}

export function InteractiveExerciseView({
  exercise,
  sheetNumber = "5.x",
}: {
  exercise: InteractiveExercise;
  /** Datasheet coordinate, e.g. "5.2"; the [slug] page derives it from the sorted order. */
  sheetNumber?: string;
}): JSX.Element {
  const total = questionCount(exercise);
  const [correct, setCorrect] = useState<ReadonlySet<number>>(new Set());
  const [draft, editDraft] = useReducer(draftReducer, EMPTY_DRAFT);
  const { slug, variant } = exercise;

  useEffect(() => {
    const saved = readAnswer(slug);
    if (!saved) return;
    // A record whose kind does not match this variant is left alone; the
    // slice trims to the questions this build renders, so a set that lost a
    // question does not carry a stranded answer back into the store.
    if (variant === "quiz" && saved.kind === "quiz") {
      editDraft({ picks: saved.answers.slice(0, total) });
    }
    if (variant === "blanks" && saved.kind === "blanks") {
      editDraft({ typed: saved.answers.slice(0, total) });
    }
    if (variant === "prediction" && saved.kind === "predict") {
      editDraft({ typed: saved.answers.slice(0, total) });
    }
  }, [slug, variant, total]);

  const pickAt = useCallback(
    (index: number, value: number | null): void => {
      const picks = withAt(draft.picks, index, value, null);
      editDraft({ picks });
      saveAnswer(slug, { kind: "quiz", answers: picks });
    },
    [draft.picks, slug],
  );

  const typeAt = useCallback(
    (index: number, value: string): void => {
      const typed = withAt(draft.typed, index, value, "");
      editDraft({ typed });
      saveAnswer(slug, { kind: variant === "blanks" ? "blanks" : "predict", answers: typed });
    },
    [draft.typed, slug, variant],
  );

  // A block locks once answered correctly, so a correct index never leaves
  // the set; when the last one lands the exercise is solved for the index.
  const handleAttempt = (index: number, isCorrect: boolean): void => {
    if (!isCorrect || correct.has(index)) return;
    const next = new Set(correct);
    next.add(index);
    setCorrect(next);
    if (next.size === total) markSolved(exercise.slug);
  };

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-5">
        <Kicker number={sheetNumber} title="exercise" />
        <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl">
          {exercise.title}
        </h1>
        <LessonMarkdown markdown={exercise.prompt} />
        <p
          role="status"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        >
          {correct.size} of {total} correct
        </p>
      </div>

      {exercise.variant === "quiz" &&
        exercise.questions.map((question, index) => (
          <QuizBlock
            key={index}
            {...question}
            value={draft.picks[index] ?? null}
            onValueChange={(value) => pickAt(index, value)}
            onAttempt={(isCorrect) => handleAttempt(index, isCorrect)}
          />
        ))}
      {exercise.variant === "prediction" &&
        exercise.predictions.map((question, index) => (
          <PredictionBlock
            key={index}
            {...question}
            value={draft.typed[index] ?? ""}
            onValueChange={(value) => typeAt(index, value)}
            onAttempt={(isCorrect) => handleAttempt(index, isCorrect)}
          />
        ))}
      {exercise.variant === "blanks" &&
        exercise.blanks.map((question, index) => (
          <BlanksBlock
            key={index}
            {...question}
            value={draft.typed[index] ?? ""}
            onValueChange={(value) => typeAt(index, value)}
            onAttempt={(isCorrect) => handleAttempt(index, isCorrect)}
          />
        ))}
      <p className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            })
          }
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline focus:outline-none focus-visible:[box-shadow:var(--ring)]"
        >
          back to top
        </button>
      </p>
    </article>
  );
}
