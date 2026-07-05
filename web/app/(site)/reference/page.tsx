import type { Metadata } from "next";
import { REFERENCE_INSTRUCTIONS } from "@/lib/reference-data";
import { ReferenceView } from "@/components/ReferenceView";
import { SHARE_CARD_IMAGE } from "@/lib/site";

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
    images: [SHARE_CARD_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "reference — cpsc 355 playground",
    description: DESCRIPTION,
    images: [SHARE_CARD_IMAGE],
  },
};

// Server page: it owns the route metadata and statically generates. The
// build-time instruction set is handed to the client view as plain data, and a
// wider measure than the article routes makes room for the two-pane index; the
// guide and catalog keep their own inner measure.
export default function ReferencePage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)]">
        reference
      </h1>
      <p className="mt-4 text-[var(--text-secondary)] [font:var(--type-lead)]">
        A searchable map of the supported instructions and the calling convention.
      </p>
      <div className="mt-10">
        <ReferenceView instructions={REFERENCE_INSTRUCTIONS} />
      </div>
    </section>
  );
}
