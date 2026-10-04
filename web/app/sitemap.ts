import type { MetadataRoute } from "next";
import { SITE_URL, NAV_ROUTES } from "@/lib/content/site";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadAllExercises } from "@/lib/content/exercises";

// Routes come from NAV_ROUTES and slugs from the loaders the pages use, so a
// new route, lesson or exercise gets its entry with no second list to keep.
// lastmod is the content's own lastUpdated, never the build time: a date that
// moves on every deploy tells crawlers every page changed, and the deploy's
// shallow clone has no history to date a file from.
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
