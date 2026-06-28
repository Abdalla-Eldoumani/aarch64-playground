import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import { RoutesRegisterFile } from "@/components/RoutesRegisterFile";
import { FeatureCatalog } from "@/components/FeatureCatalog";
import { CredibilitySection } from "@/components/CredibilitySection";

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
  },
  twitter: {
    card: "summary",
    title: "cpsc 355 playground",
    description: DESCRIPTION,
  },
};

// The landing composes the four sections top to bottom: the live hero, the
// routes-as-register-file jump table, the feature catalog, then the credibility
// band. Each section owns its own measure (the first three centre at max-w-5xl;
// the credibility band runs full-bleed by design) and its own py-12/sm:py-16
// rhythm, so the page only orders them -- no wrapper measure or extra spacing to
// avoid double-padding or clipping the band. The nav and footer come from the
// (site) layout. A server component: it renders the client Hero without itself
// going client, so the rest of the page ships no JS.
export default function LandingPage() {
  return (
    <>
      <Hero />
      <RoutesRegisterFile />
      <FeatureCatalog />
      <CredibilitySection />
    </>
  );
}
