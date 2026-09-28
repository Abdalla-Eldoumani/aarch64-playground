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

// Each section sets its own width and spacing, so the page only orders them.
// It ends at the catalog because the footer already carries the project facts.
// A server component, so only the client Hero ships JS.
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
        <DocRule section="overview" context="cpsc 355 study aid" />
      </div>
      <Hero />
      <RoutesRegisterFile />
      <FeatureCatalog />
    </>
  );
}
