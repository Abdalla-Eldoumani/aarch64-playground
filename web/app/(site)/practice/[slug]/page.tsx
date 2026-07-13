import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllExercises, loadExercise } from "@/lib/content/exercises";
import { ExerciseView } from "@/components/practice/ExerciseView";
import { SHARE_CARD_IMAGE } from "@/lib/content/site";

// Fully static: the build enumerates every valid exercise slug and, with
// dynamicParams off, only those slugs exist. Any other path falls through to the
// styled 404 instead of a dynamic render, so there is no runtime fetch and no
// server route behind this page.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadAllExercises().map((exercise) => ({ slug: exercise.slug }));
}

const FALLBACK_DESCRIPTION =
  "An AArch64 practice exercise, checked by running your program against expected behavior.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exercise = loadExercise(slug);
  if (!exercise) return { title: "exercise not found" };

  const description = exercise.topic
    ? `A practice exercise on ${exercise.topic}, checked by running your program against expected behavior.`
    : FALLBACK_DESCRIPTION;
  // The title composes through the root template (%s — cpsc 355 playground).
  // Open Graph and Twitter are not deep-merged across segments, so each exercise
  // restates the full composed title and its own url instead of inheriting.
  const composedTitle = `${exercise.title} — cpsc 355 playground`;
  return {
    title: exercise.title,
    description,
    openGraph: {
      type: "article",
      siteName: "cpsc 355 playground",
      title: composedTitle,
      description,
      url: `/practice/${slug}`,
      images: [SHARE_CARD_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: composedTitle,
      description,
      images: [SHARE_CARD_IMAGE],
    },
  };
}

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exercise = loadExercise(slug);
  if (!exercise) notFound();
  // The loader returns exercises already sorted by `order`, so the 1-based
  // position is the exercise's sheet number on the practice datasheet (5.N).
  const position = loadAllExercises().findIndex((entry) => entry.slug === slug);
  const sheetNumber = position >= 0 ? `5.${position + 1}` : "5.x";
  return <ExerciseView exercise={exercise} sheetNumber={sheetNumber} />;
}
