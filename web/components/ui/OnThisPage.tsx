import type { JSX } from "react";

/**
 * A page's contents as fragment links: folded above the page under lg, where
 * open contents would fill a phone's first screen, and a sticky rail beside
 * it from lg up. Both copies render and CSS shows one, so neither layout
 * shifts when the script runs.
 */

export interface PageSection {
  /** The id of the element each link jumps to. */
  id: string;
  label: string;
  /** Shown before the label in mono, e.g. "01". */
  number: string;
  /** 3 indents the link under the depth-2 entry above it. */
  depth?: 2 | 3;
}

const LINK_CLASS =
  "flex min-h-[44px] items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] [font:var(--type-small)] outline-none transition-colors hover:text-[var(--cyan)] focus-visible:[box-shadow:var(--ring)]";
const TITLE_CLASS = "font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]";

export function OnThisPage({
  sections,
  className = "",
}: {
  sections: PageSection[];
  className?: string;
}): JSX.Element {
  const links = sections.map((section) => (
    <li key={section.id}>
      <a href={`#${section.id}`} className={section.depth === 3 ? `${LINK_CLASS} pl-4` : LINK_CLASS}>
        <span className="mr-2 font-mono text-[12px] text-[var(--text-tertiary)]">
          {section.number}
        </span>
        {section.label}
      </a>
    </li>
  ));

  return (
    <nav aria-label="On this page" className={`lg:sticky lg:top-24 lg:h-fit ${className}`}>
      <details className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 lg:hidden">
        <summary className={`cursor-pointer select-none ${TITLE_CLASS} [@media(pointer:coarse)]:leading-[44px]`}>
          on this page
        </summary>
        <ul className="mt-3 flex flex-col">{links}</ul>
      </details>
      {/* The rail scrolls on its own when it is taller than a short
          laptop's window, so its last links never sit out of reach; the
          padding keeps the 4px focus ring inside the scroll box. */}
      <div className="hidden lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:p-1">

        <p className={TITLE_CLASS}>on this page</p>
        <ul className="flex flex-col">{links}</ul>
      </div>
    </nav>
  );
}
