import type { Metadata } from "next";
import { RouteShell } from "@/components/RouteShell";

const DESCRIPTION =
  "Step-by-step AArch64 lessons that pair a short reading with a live, runnable editor.";

export const metadata: Metadata = {
  title: "learn",
  description: DESCRIPTION,
  // Open Graph and Twitter are not deep-merged across segments, so each route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "learn — cpsc 355 playground",
    description: DESCRIPTION,
    url: "/learn",
  },
  twitter: {
    card: "summary",
    title: "learn — cpsc 355 playground",
    description: DESCRIPTION,
  },
};

export default function LearnPage() {
  return (
    <RouteShell
      title="learn"
      lead="Step-by-step lessons that pair a short reading with a live, runnable editor."
    />
  );
}
