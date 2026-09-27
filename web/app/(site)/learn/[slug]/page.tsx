import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllLessons, loadLesson } from "@/lib/content/lessons";
import { LessonArticle } from "@/components/learn/LessonArticle";
import { jsonLdGraph, lessonDescription, lessonNodes, pageMetadata, toJsonLd } from "@/lib/content/seo";

// Fully static: the build enumerates every valid lesson slug and, with
// dynamicParams off, only those slugs exist. Any other path falls through to the
// styled 404 instead of a dynamic render, so there is no runtime fetch and no
// server route behind this page.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadAllLessons().map((lesson) => ({ slug: lesson.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = loadLesson(slug);
  if (!lesson) return { title: "lesson not found" };
  return pageMetadata({
    title: lesson.title,
    description: lessonDescription(lesson),
    path: `/learn/${slug}`,
    type: "article",
  });
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = loadLesson(slug);
  if (!lesson) notFound();
  // The sheet coordinate is the lesson's 1-based position in the sorted
  // order. It is presentation only and derived at build time.
  const position = loadAllLessons().findIndex((entry) => entry.slug === lesson.slug);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLdGraph(...lessonNodes(lesson))) }}
      />
      <LessonArticle lesson={lesson} sheetNumber={`4.${position + 1}`} />
    </>
  );
}
