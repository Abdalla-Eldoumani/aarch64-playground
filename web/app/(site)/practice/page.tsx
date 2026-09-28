import type { Metadata } from "next";
import { loadExerciseIndex } from "@/lib/content/exercises";
import { ExerciseIndex } from "@/components/practice/ExerciseIndex";
import { DocRule } from "@/components/ui/DocRule";
import { Kicker } from "@/components/ui/Kicker";
import { pageMetadata } from "@/lib/content/seo";

export const metadata: Metadata = pageMetadata({
  title: "AArch64 exercises and quizzes",
  description:
    "Write AArch64 assembly that is checked by running it on hidden inputs, or test yourself with quizzes, fill-in-the-blank sets, and output predictions.",
  path: "/practice",
});

// Server page: the server-only loader validates every exercise at build time and
// the already-validated, order-sorted exercises are handed to the client index as
// plain data, so no client component ever imports the loader.
export default function PracticePage() {
  // Narrowed before it crosses the boundary: the index renders seven fields,
  // and a full exercise also carries the prompt, starter, acceptance, and
  // question sets that only the detail route reads.
  const exercises = loadExerciseIndex();
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <DocRule section="practice" context="cpsc 355 study aid" className="mb-8" />
      <Kicker number="05" title="practice" className="mb-5" />
      <h1 className="font-serif text-4xl font-semibold leading-[1.15] text-[var(--text-primary)]">
        Exercises
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--text-secondary)] [font:var(--type-lead)]">
        In a coding exercise, Check runs your program and compares its result with what the exercise asks for. Theory sets are quizzes and short questions, graded on the page. Both follow the course from the first week to the last.
      </p>
      <div className="mt-10">
        <ExerciseIndex exercises={exercises} />
      </div>
    </section>
  );
}
