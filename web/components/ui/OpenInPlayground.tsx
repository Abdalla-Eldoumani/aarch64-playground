"use client";

import Link from "next/link";

// One style for the lesson and exercise links into the playground. The hover
// tint stays faint so the cyan label keeps WCAG AA contrast on the light theme.
// Callers set margins and alignment through className.
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
