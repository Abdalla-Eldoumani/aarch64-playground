import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { RoutesRegisterFile } from "@/components/diagrams/RoutesRegisterFile";
import { FeatureCatalog } from "@/components/landing/FeatureCatalog";
import { BitRuler } from "@/components/ui/BitRuler";
import { DocRule } from "@/components/ui/DocRule";
import { SHARE_CARD_IMAGE } from "@/lib/content/site";

const DESCRIPTION =
  "Browser-based ARMv8 emulator with a visual debugger, tuned for the cpsc 355 tutorial corpus";

export const metadata: Metadata = {
  // The landing answers for the site root, so its title is the bare site name
  // rather than the "%s -- cpsc 355 playground" template the content routes
  // compose. Open Graph and Twitter are not deep-merged across segments, so the
  // home card is restated here with the canonical "/" url.
  title: { absolute: "cpsc 355 playground" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
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
      {/* The datasheet marginalia open the sheet: the bit-ruler calibration
          strip runs full-bleed under the nav, then the document rule heads
          the measure. Both are decorative chrome; the hero owns the h1. */}
      <BitRuler />
      <div className="mx-auto w-full max-w-5xl px-6 pt-6">
        <DocRule section="sheet 1 · overview" context="cpsc 355 study aid" />
      </div>
      <Hero />
      <RoutesRegisterFile />
      <FeatureCatalog />
    </>
  );
}
