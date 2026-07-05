import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { RoutesRegisterFile } from "@/components/RoutesRegisterFile";
import { FeatureCatalog } from "@/components/FeatureCatalog";
import { SHARE_CARD_IMAGE } from "@/lib/site";

const DESCRIPTION =
  "Browser-based ARMv8 emulator with a visual debugger, tuned for the cpsc 355 tutorial corpus";

export const metadata: Metadata = {
  // The landing answers for the site root, so its title is the bare site name
  // rather than the "%s — cpsc 355 playground" template the content routes
  // compose. Open Graph and Twitter are not deep-merged across segments, so the
  // home card is restated here with the canonical "/" url.
  title: { absolute: "cpsc 355 playground" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
    url: "/",
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
    images: [SHARE_CARD_IMAGE],
  },
};

// The landing composes three sections top to bottom: the live hero, the
// routes-as-register-file jump table, and the feature catalog. Each section
// owns its own measure (centred at max-w-5xl) and its own py-12/sm:py-16
// rhythm, so the page only orders them -- no wrapper measure or extra spacing.
// The nav and footer come from the (site) layout, and the footer carries the
// open-source, license, and course facts itself, so the page ends at the
// catalog rather than stacking a second footer-like band above the footer.
// A server component: it renders the client Hero without itself going client,
// so the rest of the page ships no JS.
export default function LandingPage() {
  return (
    <>
      <Hero />
      <RoutesRegisterFile />
      <FeatureCatalog />
    </>
  );
}
