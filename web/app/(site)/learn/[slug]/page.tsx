import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadAllLessons, loadLesson } from "@/lib/content/lessons";
import { LessonArticle } from "@/components/learn/LessonArticle";
import { SHARE_CARD_IMAGE, SITE_URL } from "@/lib/content/site";

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

/**
 * Serialize structured data for a ld+json script element. The lesson title and
 * summary are author-supplied JSON, and JSON.stringify does not escape "<":
 * a title containing a closing script tag would otherwise end the element
 * early. Escaping "<" keeps the payload inert wherever it lands.
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
  const lesson = loadLesson(slug);
  if (!lesson) return { title: "lesson not found" };

  const description = lesson.summary ?? FALLBACK_DESCRIPTION;
  // The title composes through the root template (%s · cpsc 355 playground).
  // Open Graph and Twitter are not deep-merged across segments, so each lesson
  // restates the full composed title and its own url instead of inheriting.
  const composedTitle = `${lesson.title} · cpsc 355 playground`;
  return {
    title: lesson.title,
    description,
    alternates: { canonical: `/learn/${slug}` },
    openGraph: {
      type: "article",
      siteName: "cpsc 355 playground",
      title: composedTitle,
      description,
      url: `/learn/${slug}`,
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

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = loadLesson(slug);
  if (!lesson) notFound();
  // The sheet coordinate is the lesson's 1-based position in the sorted
  // order -- presentation only, derived at build time, schema untouched.
  const position = loadAllLessons().findIndex((entry) => entry.slug === lesson.slug);
  // Structured data, built at build time from the validated lesson: a
  // LearningResource so the lesson reads as course material rather than a
  // generic page, and the breadcrumb trail the reader walked to reach it.
  const learningResourceJsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: lesson.title,
    description: lesson.summary ?? FALLBACK_DESCRIPTION,
    url: new URL(`/learn/${slug}`, SITE_URL).toString(),
    educationalLevel: "undergraduate",
    learningResourceType: "lesson",
    isPartOf: {
      "@type": "WebSite",
      name: "cpsc 355 playground",
      url: SITE_URL,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "learn",
        item: new URL("/learn", SITE_URL).toString(),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: lesson.title,
        item: new URL(`/learn/${slug}`, SITE_URL).toString(),
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(learningResourceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }}
      />
      <LessonArticle lesson={lesson} sheetNumber={`4.${position + 1}`} />
    </>
  );
}
