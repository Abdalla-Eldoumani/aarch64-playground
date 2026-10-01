import type { Metadata } from "next";
import { DocRule } from "@/components/ui/DocRule";
import { pageMetadata } from "@/lib/content/seo";

// The service worker answers with this page when a page that is not saved on
// the device is opened offline, under that page's own address. It is never
// linked and has no place in the index.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Not saved on this device",
    description: "This page is not saved for offline use. The playground is.",
  }),
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <DocRule section="offline" context="no connection" className="mb-8" />
      <h1 className="font-serif text-4xl font-semibold leading-[1.15] text-[var(--text-primary)]">
        Not saved on this device
      </h1>
      <p className="mt-4 text-[var(--text-secondary)] [font:var(--type-lead)]">
        You are offline, and this page has not been saved here. The playground has, so you can keep
        writing and running programs.
      </p>
      <p className="mt-3 font-serif text-[17px] leading-relaxed text-[var(--text-secondary)]">
        When you are back online, choose Save every page for offline in the menu or at the foot of
        any page to keep the lessons, practice and the reference too.
      </p>
      {/* A plain link on purpose: offline, the router's data fetch would fail
          and fall back to a full load anyway, which the worker answers. */}
      <a
        href="/playground"
        className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-action)] bg-[var(--cyan)] px-5 font-sans text-sm font-semibold text-[var(--on-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--cyan)_88%,var(--text-primary))] active:translate-y-px focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        Open the playground
      </a>
    </section>
  );
}
