import type { Metadata } from "next";
import { SHARE_CARD_IMAGE } from "@/lib/content/site";
import { fetchStarCount } from "@/lib/content/github";
import { StarCountProvider } from "@/components/chrome/StarCount";

const DESCRIPTION =
  "Assemble and step through AArch64 programs with live registers, stack, memory, and real stdin and stdout in the browser.";

export const metadata: Metadata = {
  title: "playground",
  description: DESCRIPTION,
  alternates: { canonical: "/playground" },
  // Open Graph and Twitter are not deep-merged across segments, so this route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "playground · cpsc 355 playground",
    description: DESCRIPTION,
    url: "/playground",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "playground · cpsc 355 playground",
    description: DESCRIPTION,
    images: [SHARE_CARD_IMAGE],
  },
};

// The playground page is a client component and cannot export metadata, so this
// server layout carries the route's metadata. It also runs the same hourly
// revalidated star lookup the content layout runs, so the slim bar wears the
// count the full bar wears; a failed lookup is null and the nav falls back to
// the icon-only link.
export default async function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const stars = await fetchStarCount();

  return <StarCountProvider stars={stars}>{children}</StarCountProvider>;
}
