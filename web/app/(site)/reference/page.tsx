import type { Metadata } from "next";
import { RouteShell } from "@/components/RouteShell";

const DESCRIPTION =
  "A searchable map of the supported AArch64 instructions and the calling convention.";

export const metadata: Metadata = {
  title: "reference",
  description: DESCRIPTION,
  // Open Graph and Twitter are not deep-merged across segments, so each route
  // restates the full composed title and its own url instead of inheriting.
  openGraph: {
    type: "website",
    siteName: "cpsc 355 playground",
    title: "reference — cpsc 355 playground",
    description: DESCRIPTION,
    url: "/reference",
  },
  twitter: {
    card: "summary",
    title: "reference — cpsc 355 playground",
    description: DESCRIPTION,
  },
};

export default function ReferencePage() {
  return (
    <RouteShell
      title="reference"
      lead="A searchable map of the supported instructions and the calling convention."
    />
  );
}
