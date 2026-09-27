import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { RoutesRegisterFile } from "@/components/diagrams/RoutesRegisterFile";
import { FeatureCatalog } from "@/components/landing/FeatureCatalog";
import { BitRuler } from "@/components/ui/BitRuler";
import { DocRule } from "@/components/ui/DocRule";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/content/site";
import { jsonLdGraph, pageMetadata, toJsonLd, websiteNode } from "@/lib/content/seo";

export const metadata: Metadata = pageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
});

// Each section owns its own measure (centred at max-w-5xl) and its own
// py-12/sm:py-16 rhythm, so the page only orders them, with no wrapper measure
// or extra spacing. The nav and footer come from the (site) layout, and the
// footer carries the open-source, license, and course facts itself, so the
// page ends at the catalog rather than stacking a second footer-like band
// above the footer. A server component: it renders the client Hero without
// itself going client, so the rest of the page ships no JS.
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLdGraph(websiteNode(HOME_DESCRIPTION))) }}
      />
      {/* Decorative chrome. The hero owns the h1. */}
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
