import type { MetadataRoute } from "next";
import { SITE_URL, NAV_ROUTES } from "@/lib/site";

// The landing owns the site root as its own top-priority entry; every nav route
// (the playground plus the content routes) follows from the single NAV_ROUTES
// source so the indexed set never drifts from the nav. NAV_ROUTES no longer
// contains "/", so the home entry is not duplicated. Absolute URLs are resolved
// against SITE_URL. The root changes most often and ranks highest; the nav
// routes update less and sit just below it.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: new URL("/", SITE_URL).toString(),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...NAV_ROUTES.map((route) => ({
      url: new URL(route.href, SITE_URL).toString(),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
