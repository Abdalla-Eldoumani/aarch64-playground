import type { Metadata } from "next";
import { NotFound } from "@/components/chrome/NotFound";
import { SiteNav } from "@/components/chrome/SiteNav";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SHARE_CARD_IMAGE } from "@/lib/content/site";

export const metadata: Metadata = {
  title: "404",
  description: "The page you were looking for doesn't exist.",
  // Open Graph and Twitter are not deep-merged across segments, so the 404
  // restates its own card instead of inheriting the site-wide one. No url: the
  // not-found page answers for any unmatched path, so it has no canonical
  // address to advertise.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "404 — cpsc 355 playground",
    description: "The page you were looking for doesn't exist.",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "404 — cpsc 355 playground",
    description: "The page you were looking for doesn't exist.",
    images: [SHARE_CARD_IMAGE],
  },
};

export default function NotFoundPage() {
  return (
    <div className="flex flex-col min-h-dvh">
      <SiteNav variant="full" />
      <NotFound />
      <SiteFooter />
    </div>
  );
}
