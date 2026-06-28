import type { Metadata } from "next";

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

export default function LandingPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)]">
        cpsc 355 playground
      </h1>
      <p className="mt-4 font-serif text-lg leading-relaxed text-[var(--text-secondary)]">
        A browser-based AArch64 emulator and visual debugger for the cpsc 355
        tutorial corpus: paste a program, assemble it, and step through real
        registers, stack, memory, and I/O without leaving the tab.
      </p>
    </section>
  );
}
