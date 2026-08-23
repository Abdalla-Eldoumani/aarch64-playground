import Link from "next/link";
import {
  NAV_ROUTES,
  REPO_URL,
  LICENSE_URL,
  LICENSE_LABEL,
  CREDIBILITY,
} from "@/lib/content/site";
import { Wordmark } from "@/components/ui/Wordmark";

// Footer links share one quiet -> cyan-on-hover treatment, all from tokens.
const LINK_CLASS =
  "rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:text-[var(--cyan)] focus:outline-none focus-visible:[box-shadow:var(--ring)]";

/**
 * The persistent site footer shared by the content layout and the 404: the brand
 * wordmark with a one-line description and the Rust-to-WASM engine note, the
 * route links, the repository and license links, the course context, the
 * open-source line, and the not-affiliated disclaimer. The one footer everywhere,
 * the landing included -- it carries the project's credibility facts itself so no
 * page needs a second footer-like band above it. Stays a server component (no
 * hooks) so it ships no client JS and can be imported by server layouts. The
 * author's name lives only in the committed LICENSE, never here.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-xs flex-col gap-3">
          <Wordmark showLabel size="footer" />
          <p className="font-serif text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {CREDIBILITY.tagline}
          </p>
          <p className="font-serif text-[15px] leading-relaxed text-[var(--text-secondary)]">
            The emulator is{" "}
            <span className="font-mono text-sm text-[var(--text-primary)]">
              {CREDIBILITY.engineNote}
            </span>
            .
          </p>
        </div>

        <nav aria-label="footer" className="flex flex-col gap-2 font-sans text-sm">
          {NAV_ROUTES.map((route) => (
            <Link key={route.href} href={route.href} className={LINK_CLASS}>
              {route.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 font-sans text-sm">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className={LINK_CLASS}
          >
            repository
          </a>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="AGPL-3.0 license"
            className={LINK_CLASS}
          >
            {LICENSE_LABEL}
          </a>
          <span className="text-[var(--text-tertiary)]">
            {CREDIBILITY.courseContext}
          </span>
        </div>
      </div>

      {/* The closing doc-rule line: the sheet's colophon in the datasheet
          voice, over a hairline like the document rule that opened it,
          segments spread across the measure. */}
      <div className="mx-auto mt-8 flex w-full max-w-5xl flex-wrap justify-between gap-x-6 gap-y-1 border-t border-[var(--border)] pt-3 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.08em] text-[var(--text-tertiary)]">
        <span>Open source · free to use and study</span>
        <span>{CREDIBILITY.privacyNote}</span>
        <span>{CREDIBILITY.disclaimer}</span>
      </div>
    </footer>
  );
}
