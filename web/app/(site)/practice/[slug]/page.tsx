import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllExercises, loadExercise } from "@/lib/content/exercises";
import { ExerciseView } from "@/components/practice/ExerciseView";
import { InteractiveExerciseView } from "@/components/practice/InteractiveExerciseView";
import { exerciseDescription, exerciseNodes, jsonLdGraph, pageMetadata, toJsonLd } from "@/lib/content/seo";

// Fully static: the build enumerates every valid exercise slug and, with
// dynamicParams off, only those slugs exist. Any other path falls through to the
// styled 404 instead of a dynamic render, so there is no runtime fetch and no
// server route behind this page.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadAllExercises().map((exercise) => ({ slug: exercise.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exercise = loadExercise(slug);
  if (!exercise) return { title: "exercise not found" };
  // Three theory sets in a family share one title, so the tab and share-card
  // title carries the difficulty that tells them apart; the page h1 keeps the
  // bare content title.
  return pageMetadata({
    title: exercise.difficulty ? `${exercise.title} (${exercise.difficulty})` : exercise.title,
    description: exerciseDescription(exercise),
    path: `/practice/${slug}`,
    type: "article",
  });
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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLdGraph(...exerciseNodes(exercise))) }}
      />
      {exercise.variant === "quiz" ||
      exercise.variant === "prediction" ||
      exercise.variant === "blanks" ? (
        <InteractiveExerciseView exercise={exercise} sheetNumber={sheetNumber} />
      ) : (
        <ExerciseView exercise={exercise} sheetNumber={sheetNumber} />
      )}
    </>
  );
}
