import type { Metadata } from "next";
import { NotFound } from "@/components/chrome/NotFound";
import { SiteNav } from "@/components/chrome/SiteNav";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { fetchStarCount } from "@/lib/content/github";
import { pageMetadata } from "@/lib/content/seo";

// The 404 answers for every unmatched path, so it has no address of its own:
// no path (so no canonical and no card url), and no place in the index.
export const metadata: Metadata = {
  ...pageMetadata({ title: "404", description: "The page you were looking for doesn't exist." }),
  robots: { index: false },
};

export default async function NotFoundPage() {
  // Same build-time lookup the content layout does; the 404 wears the same
  // nav, so it carries the same count.
  const stars = await fetchStarCount();

  return (
    <div className="flex flex-col min-h-dvh">
      <SiteNav variant="full" stars={stars} />
      <NotFound />
      <SiteFooter />
    </div>
  );
}
