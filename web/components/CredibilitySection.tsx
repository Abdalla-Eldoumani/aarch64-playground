import { REPO_URL, LICENSE_URL, LICENSE_LABEL, CREDIBILITY } from "@/lib/site";

// The repository and license links share one cyan, rel-hardened, focus-ringed
// treatment, all from tokens.
const LINK_CLASS =
  "rounded-[var(--radius-control)] text-[var(--cyan)] underline-offset-2 hover:underline focus:outline-none focus-visible:[box-shadow:var(--ring)]";

/**
 * The credibility band: open-source + MIT (linked to the LICENSE), the
 * built-for-CPSC-355 / not-affiliated disclaimer, the repository link, and the
 * hand-written Rust-to-WASM note. Every string is read from the shared site.ts
 * constants -- the same source the footer reads -- so the two surfaces can never
 * disagree, and the author's name stays in the committed LICENSE, never the body.
 * A server component (no hooks); the external links are rel-hardened.
 */
export function CredibilitySection() {
  return (
    <section
      aria-labelledby="credibility-heading"
      className="border-y border-[var(--border)] bg-[var(--bg-sunken)] px-6 py-12 sm:py-16"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h2
          id="credibility-heading"
          className="font-serif text-2xl font-semibold leading-tight text-[var(--text-primary)]"
        >
          open source
        </h2>

        <p className="font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
          Released under the{" "}
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="MIT license"
            className={LINK_CLASS}
          >
            {LICENSE_LABEL}
          </a>{" "}
          license, free to use and study. The emulator is{" "}
          <span className="font-mono text-[var(--text-primary)]">{CREDIBILITY.engineNote}</span>
          , running entirely in your browser.
        </p>

        <p className="font-mono text-xs text-[var(--text-tertiary)]">{CREDIBILITY.disclaimer}</p>

        <div className="font-sans text-sm">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className={LINK_CLASS}
          >
            repository
          </a>
        </div>
      </div>
    </section>
  );
}
