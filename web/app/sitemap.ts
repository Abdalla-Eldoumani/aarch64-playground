import type { MetadataRoute } from "next";
import { SITE_URL, NAV_ROUTES } from "@/lib/content/site";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadAllExercises } from "@/lib/content/exercises";

// The landing owns the site root as its own top-priority entry; every nav route
// (the playground plus the content routes) follows from the single NAV_ROUTES
// source so the indexed set never drifts from the nav. Absolute URLs are
// resolved against SITE_URL.
//
// The slugs come from the same build-time loaders the pages themselves use, so
// dropping a lesson or exercise JSON file adds its page AND its sitemap entry
// with no second list to remember.
//
// lastmod is the content's own lastUpdated date, never the build time: a
// date that moves on every deploy tells a crawler every page changed, and the
// deploy's shallow clone has no history to date a file from. An index is as
// new as its newest item; a route with no content file states no date.
export default function sitemap(): MetadataRoute.Sitemap {
  const lessons = loadAllLessons();
  const exercises = loadAllExercises();
  // YYYY-MM-DD sorts as text in date order.
  const newest = (items: { lastUpdated?: string }[]) =>
    items.flatMap((item) => (item.lastUpdated ? [item.lastUpdated] : [])).sort().at(-1);
  const indexDates: Record<string, string | undefined> = {
    "/learn": newest(lessons),
    "/practice": newest(exercises),
  };
  const entry = (
    path: string,
    lastModified: string | undefined,
    changeFrequency: "weekly" | "monthly",
    priority: number,
  ) => ({
    url: new URL(path, SITE_URL).toString(),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  });
  return [
    entry("/", undefined, "weekly", 1),
    ...NAV_ROUTES.map((route) => entry(route.href, indexDates[route.href], "monthly", 0.8)),
    ...lessons.map((lesson) => entry(`/learn/${lesson.slug}`, lesson.lastUpdated, "monthly", 0.6)),
    ...exercises.map((exercise) =>
      entry(`/practice/${exercise.slug}`, exercise.lastUpdated, "monthly", 0.6),
    ),
  ];
}
