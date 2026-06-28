import type { Metadata } from "next";
import { RouteShell } from "@/components/RouteShell";

const DESCRIPTION =
  "AArch64 exercises checked by running your program against expected behavior, not a stored solution.";

export const metadata: Metadata = {
  title: "practice",
  description: DESCRIPTION,
  // Open Graph and Twitter are not deep-merged across segments, so each route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "practice — cpsc 355 playground",
    description: DESCRIPTION,
    url: "/practice",
  },
  twitter: {
    card: "summary",
    title: "practice — cpsc 355 playground",
    description: DESCRIPTION,
  },
};

export default function PracticePage() {
  return (
    <RouteShell
      title="practice"
      lead="Exercises checked by running your program against expected behavior, never by matching a stored solution."
    />
  );
}
