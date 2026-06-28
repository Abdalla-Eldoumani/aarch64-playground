import Link from "next/link";
import {
  NAV_ROUTES,
  REPO_URL,
  LICENSE_URL,
  LICENSE_LABEL,
  CREDIBILITY,
} from "@/lib/site";
import { Wordmark } from "@/components/Wordmark";

// Footer links share one quiet -> cyan-on-hover treatment, all from tokens.
const LINK_CLASS =
  "rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:text-[var(--cyan)] focus:outline-none focus-visible:[box-shadow:var(--ring)]";

/**
 * The persistent site footer shared by the content layout and the 404: the brand
 * wordmark with a one-line description, the route links, the repository and MIT
 * license links, the course context, and the not-affiliated disclaimer. Stays a
 * server component (no hooks) so it ships no client JS and can be imported by
 * server layouts. The author's name lives only in the committed LICENSE, never here.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-sunken)] px-6 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-xs flex-col gap-3">
          <Wordmark showLabel />
          <p className="font-serif text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {CREDIBILITY.tagline}
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
            aria-label="MIT license"
            className={LINK_CLASS}
          >
            {LICENSE_LABEL}
          </a>
          <span className="text-[var(--text-tertiary)]">
            {CREDIBILITY.courseContext}
          </span>
        </div>
      </div>

      <p className="mx-auto mt-8 w-full max-w-5xl font-mono text-xs text-[var(--text-tertiary)]">
        {CREDIBILITY.disclaimer}
      </p>
    </footer>
  );
}
