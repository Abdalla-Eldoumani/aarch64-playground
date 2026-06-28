import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllLessons, loadLesson } from "@/lib/lessons";
import { LessonArticle } from "@/components/LessonArticle";

// Fully static: the build enumerates every valid lesson slug and, with
// dynamicParams off, only those slugs exist. Any other path falls through to the
// styled 404 instead of a dynamic render, so there is no runtime fetch and no
// server route behind this page.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadAllLessons().map((lesson) => ({ slug: lesson.slug }));
}

const FALLBACK_DESCRIPTION =
  "An AArch64 lesson that pairs a short reading with a live, runnable editor.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = loadLesson(slug);
  if (!lesson) return { title: "lesson not found" };

  const description = lesson.summary ?? FALLBACK_DESCRIPTION;
  // The title composes through the root template (%s — cpsc 355 playground).
  // Open Graph and Twitter are not deep-merged across segments, so each lesson
  // restates the full composed title and its own url instead of inheriting.
  const composedTitle = `${lesson.title} — cpsc 355 playground`;
  return {
    title: lesson.title,
    description,
    openGraph: {
      type: "article",
      siteName: "cpsc 355 playground",
      title: composedTitle,
      description,
      url: `/learn/${slug}`,
    },
    twitter: {
      card: "summary",
      title: composedTitle,
      description,
    },
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = loadLesson(slug);
  if (!lesson) notFound();
  return <LessonArticle lesson={lesson} />;
}
