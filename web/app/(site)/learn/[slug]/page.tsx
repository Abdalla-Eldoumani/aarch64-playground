import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllLessons, loadLesson } from "@/lib/content/lessons";
import { loadExerciseIndex } from "@/lib/content/exercises";
import { lessonLinks } from "@/lib/content/lesson-links";
import { LessonArticle } from "@/components/learn/LessonArticle";
import { LessonNav } from "@/components/learn/LessonNav";
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
  // The sheet number and both neighbours come from the sorted order, worked
  // out at build time.
  const { number, previous, next, practice } = lessonLinks(
    loadAllLessons(),
    lesson.slug,
    loadExerciseIndex(),
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLdGraph(...lessonNodes(lesson))) }}
      />
      <LessonArticle lesson={lesson} sheetNumber={number}>
        <LessonNav previous={previous} next={next} practice={practice} />
      </LessonArticle>
    </>
  );
}
