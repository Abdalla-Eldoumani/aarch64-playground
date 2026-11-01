import type { Metadata } from "next";
import type { ReactNode } from "react";
import { loadExerciseIndex } from "@/lib/content/exercises";
import { ExerciseIndex } from "@/components/practice/ExerciseIndex";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { DocRule } from "@/components/ui/DocRule";
import { Kicker } from "@/components/ui/Kicker";
import { pageMetadata } from "@/lib/content/seo";
import { slugify } from "@/lib/content/lesson-toc";
import { PRACTICE_SIDES } from "@/lib/content/practice-topics";

export const metadata: Metadata = pageMetadata({
  title: "AArch64 exercises and quizzes",
  description:
    "Write AArch64 assembly checked on hidden inputs, test yourself with quizzes, blanks and output predictions, or draw a function's stack frame.",
  path: "/practice",
});

// The id ExerciseIndex gives the frame side's heading, as its jump link uses.
const FRAME_SIDE_HREF = `#${slugify(PRACTICE_SIDES.find((side) => side.id === "frame")?.title ?? "")}`;

// Hover thickens the underline, as a lesson's links do.
const LINK_CLASS =
  "rounded-[2px] text-[var(--cyan)] underline underline-offset-2 outline-none hover:decoration-2 focus-visible:[box-shadow:var(--ring)]";

// Server page: the server-only loader validates every exercise at build time and
// the already-validated, order-sorted exercises are handed to the client index as
// plain data, so no client component ever imports the loader.
export default function PracticePage() {
  // Narrowed before it crosses the boundary: the index renders seven fields,
  // and a full exercise also carries the prompt, starter, acceptance, and
  // question sets that only the detail route reads.
  const exercises = loadExerciseIndex();
  // Rendered here, at build time, so the markdown renderer stays out of the
  // page's script: only the finished code spans cross to the client index.
  // A plain object, not a list, so no key rides each blurb in the payload.
  const blurbs: Record<string, ReactNode> = {};
  for (const { slug, blurb } of exercises) {
    blurbs[slug] = <LessonMarkdown inline markdown={blurb} />;
  }
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <DocRule section="practice" context="cpsc 355 study aid" className="mb-8" />
      <Kicker number="05" title="practice" className="mb-5" />
      <h1 className="font-serif text-4xl font-semibold leading-[1.15] text-[var(--text-primary)]">
        Exercises
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--text-secondary)] [font:var(--type-lead)]">
        In a coding exercise, Check runs your program and compares its result with what the exercise asks for. Theory sets are quizzes and short questions, graded on the page. Coding exercises and theory sets follow the course from the first week to the last.{" "}
        <a href={FRAME_SIDE_HREF} className={LINK_CLASS}>
          In a frame drawing, you fill in a paused function&apos;s stack frame and the emulator checks each field.
        </a>
      </p>
      <div className="mt-10">
        <ExerciseIndex exercises={exercises} blurbs={blurbs} />
      </div>
    </section>
  );
}
