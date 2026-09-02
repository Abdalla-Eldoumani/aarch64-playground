"use client";

import Link from "next/link";

// A bordered cyan pill (cyan = the reader acting), shared by the lesson article
// (code and editor blocks) and the exercise sheet so the playground hand-off
// reads as one control everywhere. 44px tall for a coarse-pointer target; the
// resting outline carries the button shape, hover tints the fill (kept light
// enough that the cyan label still clears WCAG AA on the light surface), focus
// shows the ring token. Layout (margins, self-alignment) comes through
// className so each caller places it without forking the style.
const CLASS =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] whitespace-nowrap " +
  "border border-[color-mix(in_srgb,var(--cyan)_60%,transparent)] px-3 " +
  "text-[var(--cyan)] [font:var(--type-small)] outline-none transition-colors " +
  "hover:bg-[color-mix(in_srgb,var(--cyan)_8%,transparent)] focus-visible:[box-shadow:var(--ring)]";

/**
 * The "Open in playground" hand-off, styled as a button. `href` is a
 * `/playground#...` deep link the caller builds with buildShareHash.
 */
export function OpenInPlayground({
  href,
  className = "",
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`${CLASS} ${className}`}>
      Open in playground
      <span aria-hidden="true">-&gt;</span>
    </Link>
  );
}
