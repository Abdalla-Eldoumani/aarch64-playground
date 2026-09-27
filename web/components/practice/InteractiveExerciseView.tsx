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
 * can be saved per slug and restored on a later visit, together with which
 * questions were already checked and right, so those open answered. Restoring happens
 * after mount: reading storage during the first render would put a value in
 * the DOM the server render could not have, and hydration would flag it.
 */

import { useCallback, useEffect, useReducer, type JSX } from "react";
import type {
  BlanksExercise,
  PredictionExercise,
  QuizExercise,
} from "@/lib/content/exercise-schema";
import { markSolved } from "@/lib/playground/solved-state";
import { readAnswer, saveAnswer } from "@/lib/playground/exercise-answers";
import { typedAnswerIsRight } from "@/lib/content/theory-answers";
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
 * quiz picks option indices, the other two collect typed text. `graded` holds
 * the questions checked and right, in the order they landed.
 */
interface AnswerDraft {
  picks: (number | null)[];
  typed: string[];
  graded: number[];
}

const EMPTY_DRAFT: AnswerDraft = { picks: [], typed: [], graded: [] };

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

/** Whether a stored answer still passes its question, by the blocks' own rules. */
function stillRight(
  exercise: InteractiveExercise,
  index: number,
  answer: number | string | null | undefined,
): boolean {
  switch (exercise.variant) {
    case "quiz":
      return answer === exercise.questions[index].correctAnswer;
    case "blanks":
      return typeof answer === "string" && typedAnswerIsRight(exercise.blanks[index].blanks, answer);
    case "prediction":
      return (
        typeof answer === "string" && typedAnswerIsRight([exercise.predictions[index].answer], answer)
      );
    default: {
      const exhaustive: never = exercise;
      return exhaustive;
    }
  }
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
  const [draft, editDraft] = useReducer(draftReducer, EMPTY_DRAFT);
  const { slug, variant } = exercise;

  useEffect(() => {
    const saved = readAnswer(slug);
    if (!saved || saved.kind === "write") return;
    // A record whose kind does not match this variant is left alone; the
    // slice trims to the questions this build renders, so a set that lost a
    // question does not carry a stranded answer back. A question comes back
    // checked only while its stored answer still passes, in case the set's
    // answer changed since.
    const graded = (answers: readonly (number | string | null)[]): number[] =>
      (saved.graded ?? []).filter((index) => index < total && stillRight(exercise, index, answers[index]));
    if (exercise.variant === "quiz" && saved.kind === "quiz") {
      const picks = saved.answers.slice(0, total);
      editDraft({ picks, graded: graded(picks) });
    }
    if (exercise.variant === "blanks" && saved.kind === "blanks") {
      const typed = saved.answers.slice(0, total);
      editDraft({ typed, graded: graded(typed) });
    }
    if (exercise.variant === "prediction" && saved.kind === "predict") {
      const typed = saved.answers.slice(0, total);
      editDraft({ typed, graded: graded(typed) });
    }
  }, [slug, exercise, total]);

  // Every write carries both halves of the record, so storing an answer can
  // never forget which questions were already right, or the reverse.
  const store = useCallback(
    (next: AnswerDraft): void => {
      if (variant === "quiz") {
        saveAnswer(slug, { kind: "quiz", answers: next.picks, graded: next.graded });
      } else {
        const kind = variant === "blanks" ? "blanks" : "predict";
        saveAnswer(slug, { kind, answers: next.typed, graded: next.graded });
      }
    },
    [slug, variant],
  );

  const pickAt = useCallback(
    (index: number, value: number | null): void => {
      const picks = withAt(draft.picks, index, value, null);
      editDraft({ picks });
      store({ ...draft, picks });
    },
    [draft, store],
  );

  const typeAt = useCallback(
    (index: number, value: string): void => {
      const typed = withAt(draft.typed, index, value, "");
      editDraft({ typed });
      store({ ...draft, typed });
    },
    [draft, store],
  );

  // A block locks once answered correctly, so a correct index never leaves
  // the list; when the last one lands the exercise is solved for the index.
  const handleAttempt = (index: number, isCorrect: boolean): void => {
    if (!isCorrect || draft.graded.includes(index)) return;
    const graded = [...draft.graded, index];
    editDraft({ graded });
    store({ ...draft, graded });
    if (graded.length === total) markSolved(exercise.slug);
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
          {draft.graded.length} of {total} correct
        </p>
      </div>

      {exercise.variant === "quiz" &&
        exercise.questions.map((question, index) => (
          <QuizBlock
            key={index}
            {...question}
            value={draft.picks[index] ?? null}
            onValueChange={(value) => pickAt(index, value)}
            locked={draft.graded.includes(index)}
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
            locked={draft.graded.includes(index)}
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
            locked={draft.graded.includes(index)}
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
