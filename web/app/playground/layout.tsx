import type { Metadata } from "next";
import { fetchStarCount } from "@/lib/content/github";
import { StarCountProvider } from "@/components/chrome/StarCount";
import { applicationNode, jsonLdGraph, pageMetadata, toJsonLd } from "@/lib/content/seo";

const DESCRIPTION =
  "Assemble and step through AArch64 programs with live registers, stack, memory, and real stdin and stdout in the browser.";

export const metadata: Metadata = pageMetadata({
  title: "Run and debug AArch64 assembly",
  description: DESCRIPTION,
  path: "/playground",
});

// The playground page is a client component and cannot export metadata, so this
// server layout carries the route's metadata and its structured data. It also
// runs the same build-time star lookup the content layout runs, so the slim bar
// wears the count the full bar wears; a failed lookup is null and the nav falls
// back to the icon-only link.
export default async function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const stars = await fetchStarCount();

  return (
    <StarCountProvider stars={stars}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLdGraph(applicationNode(DESCRIPTION))) }}
      />
      {children}
    </StarCountProvider>
  );
}
