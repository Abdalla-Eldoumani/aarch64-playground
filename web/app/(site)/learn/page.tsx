import type { Metadata } from "next";
import { loadLessonIndex } from "@/lib/content/lessons";
import { LessonIndex } from "@/components/learn/LessonIndex";
import { DocRule } from "@/components/ui/DocRule";
import { Kicker } from "@/components/ui/Kicker";
import { pageMetadata } from "@/lib/content/seo";

export const metadata: Metadata = pageMetadata({
  title: "AArch64 assembly lessons",
  description:
    "Lessons in AArch64 assembly, from registers and loops to the stack, subroutines, floating point, and system calls, each with an editor you can run.",
  path: "/learn",
});

// Server page: the server-only loader validates every lesson at build time and
// the already-validated, order-sorted lessons are handed to the client index as
// plain data, so no client component ever imports the loader.
export default function LearnPage() {
  // Narrowed before it crosses the boundary: the index renders five fields,
  // and the lesson bodies it never reads are almost all of the weight.
  const lessons = loadLessonIndex();
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <DocRule section="sheet 04 · learn" context="cpsc 355 study aid" className="mb-8" />
      <Kicker number="04" title="learn" className="mb-5" />
      <h1 className="font-serif text-4xl font-semibold leading-[1.15] text-[var(--text-primary)]">
        Lessons
      </h1>
      <p className="mt-4 text-[var(--text-secondary)] [font:var(--type-lead)]">
        Step-by-step lessons that pair a short reading with a live, runnable editor.
      </p>
      <div className="mt-10">
        <LessonIndex lessons={lessons} />
      </div>
    </section>
  );
}
