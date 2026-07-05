import type { Metadata } from "next";
import { loadAllExercises } from "@/lib/exercises";
import { ExerciseIndex } from "@/components/ExerciseIndex";
import { SHARE_CARD_IMAGE } from "@/lib/site";

const DESCRIPTION =
  "AArch64 exercises checked by running your program against expected behavior, not a stored solution.";

export const metadata: Metadata = {
  title: "practice",
  description: DESCRIPTION,
  // Open Graph and Twitter are not deep-merged across segments, so each route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "practice — cpsc 355 playground",
    description: DESCRIPTION,
    url: "/practice",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "practice — cpsc 355 playground",
    description: DESCRIPTION,
    images: [SHARE_CARD_IMAGE],
  },
};

// Server page: the server-only loader validates every exercise at build time and
// the already-validated, order-sorted exercises are handed to the client index as
// plain data, so no client component ever imports the loader.
export default function PracticePage() {
  const exercises = loadAllExercises();
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)]">
        practice
      </h1>
      <p className="mt-4 text-[var(--text-secondary)] [font:var(--type-lead)]">
        Exercises checked by running your program against expected behavior, never by matching a stored solution.
      </p>
      <div className="mt-10">
        <ExerciseIndex exercises={exercises} />
      </div>
    </section>
  );
}
