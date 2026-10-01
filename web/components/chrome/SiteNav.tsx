"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPO_URL, NAV_ROUTES, isActiveRoute } from "@/lib/content/site";
import { formatStarCount } from "@/lib/content/github";
import { Wordmark } from "@/components/ui/Wordmark";
import { GitHubIcon } from "@/components/chrome/SiteIcons";
import { ThemeControl } from "@/components/chrome/ThemeControl";
import { MobileNavDrawer } from "@/components/chrome/MobileNavDrawer";

/**
 * In the App Router `prefetch={false}` also stops hover prefetch, so the link
 * returns to the default on hover or focus. The landing's first load skips
 * four route payloads, and a link a reader aims at still arrives warm.
 */
function HoverPrefetchLink({
  href,
  children,
  ...rest
}: ComponentProps<typeof Link>) {
  const [warm, setWarm] = useState(false);
  return (
    <Link
      href={href}
      prefetch={warm ? null : false}
      onMouseEnter={() => setWarm(true)}
      onFocus={() => setWarm(true)}
      {...rest}
    >
      {children}
    </Link>
  );
}

/**
 * One nav with two variants, so there is no second bar to keep in sync. `slim`
 * is the playground's shorter bar, kept low so the debugger keeps its height.
 * `stars` is optional because only server-rendered mounts know it; null shows
 * the icon-only link, the same as a failed lookup.
 */
export function SiteNav({
  variant,
  stars = null,
}: {
  variant: "full" | "slim";
  stars?: number | null;
}) {
  const pathname = usePathname();
  const full = variant === "full";
  const starCount = stars === null ? null : formatStarCount(stars);

  return (
    <nav
      aria-label="primary"
      // The full nav floats over the blueprint paper, so it takes a
      // translucent base with a backdrop blur (the artboards' rgba band);
      // the slim playground nav stays opaque over the flat debugger.
      className={`safe-area-top w-full border-b border-[var(--border)] ${
        full
          ? "h-14 bg-[color-mix(in_srgb,var(--bg-base)_72%,transparent)] backdrop-blur-md md:h-16"
          : "h-14 bg-[var(--bg-base)] md:h-12"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-screen-xl items-center justify-between gap-3 px-4">
        {/* The label yields under sm: the actions cluster plus the labeled mark
            is wider than a 375px viewport, and the mark alone still brands the
            bar. The footer keeps the full label at every width. */}
        <Wordmark showLabel={full ? "sm-up" : false} />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ROUTES.map((route) => {
            const active = isActiveRoute(pathname, route.href);
            return (
              <li key={route.href}>
                <HoverPrefetchLink
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center px-3 font-sans text-[14px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                    active
                      ? "text-[var(--cyan)] [box-shadow:inset_0_-2px_0_0_var(--cyan)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {route.label}
                </HoverPrefetchLink>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1">
          {/* The count rides inside the same anchor so there is one 44px target
              that widens instead of a second control beside it. Tertiary text:
              a star count is not execution state and not an action. The numeral
              is aria-hidden because the label already reads it, spelled out and
              pluralized. */}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={
              stars === null
                ? "source on github"
                : `source on github, ${stars} ${stars === 1 ? "star" : "stars"}`
            }
            className={`hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)] md:inline-flex${
              starCount === null ? "" : " gap-1.5 px-2"
            }`}
          >
            <GitHubIcon className="h-4 w-4" />
            {starCount === null ? null : (
              <span
                aria-hidden="true"
                className="font-mono text-[12px] tabular-nums text-[var(--text-tertiary)]"
              >
                {starCount}
              </span>
            )}
          </a>

          {/* The bar's copy yields under md, exactly where MobileNavDrawer
              (its root is md:hidden) starts carrying the comfortable one, so
              one theme control is reachable at every width and never two. */}
          <div className="hidden md:flex">
            <ThemeControl size="compact" />
          </div>

          {full ? (
            <Link
              href="/playground"
              className="hidden min-h-[44px] items-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-4 font-sans text-[14px] font-medium text-[var(--on-cyan)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:[box-shadow:var(--ring)] lg:inline-flex"
            >
              Open playground
            </Link>
          ) : null}

          <MobileNavDrawer stars={stars} />
        </div>
      </div>
    </nav>
  );
}
