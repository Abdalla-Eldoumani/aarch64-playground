import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllExercises, loadExercise } from "@/lib/content/exercises";
import { ExerciseView } from "@/components/practice/ExerciseView";
import { InteractiveExerciseView } from "@/components/practice/InteractiveExerciseView";
import { SHARE_CARD_IMAGE, SITE_URL } from "@/lib/content/site";

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

/**
 * Serialize structured data for a ld+json script element. The exercise title is
 * author-supplied JSON, and JSON.stringify does not escape "<": a title
 * containing a closing script tag would otherwise end the element early.
 * Escaping "<" keeps the payload inert wherever it lands.
 */
function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

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
  // Three theory sets in a family share one title, so the tab and share-card
  // title carries the difficulty that tells them apart; the page h1 keeps the
  // bare content title.
  const pageTitle = exercise.difficulty
    ? `${exercise.title} (${exercise.difficulty})`
    : exercise.title;
  // The title composes through the root template (%s · cpsc 355 playground).
  // Open Graph and Twitter are not deep-merged across segments, so each exercise
  // restates the full composed title and its own url instead of inheriting.
  const composedTitle = `${pageTitle} · cpsc 355 playground`;
  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/practice/${slug}` },
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
  // The breadcrumb trail the reader walked to reach this sheet, built at build
  // time from the validated exercise.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "practice",
        item: new URL("/practice", SITE_URL).toString(),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: exercise.title,
        item: new URL(`/practice/${slug}`, SITE_URL).toString(),
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }}
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
