import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/content/site";

// Open to all crawlers for the public release, with the sitemap pointer resolved
// from the same SITE_URL source the sitemap itself uses.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
