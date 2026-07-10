import type { Metadata } from "next";
import { loadAllLessons } from "@/lib/lessons";
import { LessonIndex } from "@/components/LessonIndex";
import { DocRule } from "@/components/DocRule";
import { Kicker } from "@/components/Kicker";
import { SHARE_CARD_IMAGE } from "@/lib/site";

const DESCRIPTION =
  "Step-by-step AArch64 lessons that pair a short reading with a live, runnable editor.";

export const metadata: Metadata = {
  title: "learn",
  description: DESCRIPTION,
  // Open Graph and Twitter are not deep-merged across segments, so each route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "learn — cpsc 355 playground",
    description: DESCRIPTION,
    url: "/learn",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "learn — cpsc 355 playground",
    description: DESCRIPTION,
    images: [SHARE_CARD_IMAGE],
  },
};

// Server page: the server-only loader validates every lesson at build time and
// the already-validated, order-sorted lessons are handed to the client index as
// plain data, so no client component ever imports the loader.
export default function LearnPage() {
  const lessons = loadAllLessons();
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
