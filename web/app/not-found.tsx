import type { Metadata } from "next";
import { NotFound } from "@/components/chrome/NotFound";
import { SiteNav } from "@/components/chrome/SiteNav";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SHARE_CARD_IMAGE } from "@/lib/content/site";
import { fetchStarCount } from "@/lib/content/github";

export const metadata: Metadata = {
  title: "404",
  description: "The page you were looking for doesn't exist.",
  // The 404 answers for every unmatched path, so it has no address of its own:
  // no place in the index, and no canonical. `alternates: null` is load-bearing
  // -- alternates are inherited from the root layout, so without it every
  // unmatched path advertised the site root as its canonical address.
  robots: { index: false },
  alternates: null,
  // Open Graph and Twitter are not deep-merged across segments, so the 404
  // restates its own card instead of inheriting the site-wide one. No url, for
  // the same reason there is no canonical.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "404 -- cpsc 355 playground",
    description: "The page you were looking for doesn't exist.",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "404 -- cpsc 355 playground",
    description: "The page you were looking for doesn't exist.",
    images: [SHARE_CARD_IMAGE],
  },
};

export default async function NotFoundPage() {
  // Same hourly-revalidated lookup the content layout does; the 404 wears the
  // same nav, so it carries the same count.
  const stars = await fetchStarCount();

  return (
    <div className="flex flex-col min-h-dvh">
      <SiteNav variant="full" stars={stars} />
      <NotFound />
      <SiteFooter />
    </div>
  );
}
