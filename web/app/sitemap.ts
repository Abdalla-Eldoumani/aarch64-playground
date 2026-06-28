import type { MetadataRoute } from "next";
import { SITE_URL, NAV_ROUTES } from "@/lib/site";

// One sitemap entry per public route, built from the single NAV_ROUTES source so
// the indexed set never drifts from the nav. Absolute URLs are resolved against
// SITE_URL. The home route changes most often and ranks highest; the content
// routes update less and sit just below it.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return NAV_ROUTES.map((route) => {
    const isHome = route.href === "/";
    return {
      url: new URL(route.href, SITE_URL).toString(),
      lastModified,
      changeFrequency: isHome ? "weekly" : "monthly",
      priority: isHome ? 1 : 0.8,
    };
  });
}
