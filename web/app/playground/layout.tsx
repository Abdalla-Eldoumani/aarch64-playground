import type { Metadata } from "next";

const DESCRIPTION =
  "Assemble and step through AArch64 programs with live registers, stack, memory, and real stdin and stdout in the browser.";

export const metadata: Metadata = {
  title: "playground",
  description: DESCRIPTION,
  // Open Graph and Twitter are not deep-merged across segments, so this route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "playground — cpsc 355 playground",
    description: DESCRIPTION,
    url: "/playground",
  },
  twitter: {
    card: "summary",
    title: "playground — cpsc 355 playground",
    description: DESCRIPTION,
  },
};

// The playground page is a client component and cannot export metadata, so this
// server layout carries the route's metadata and renders the page unchanged.
export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
