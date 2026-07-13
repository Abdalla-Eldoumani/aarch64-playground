"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPO_URL, NAV_ROUTES, isActiveRoute } from "@/lib/content/site";
import { Wordmark } from "@/components/ui/Wordmark";
import { GitHubIcon } from "@/components/chrome/SiteIcons";
import { ThemeControl } from "@/components/chrome/ThemeControl";
import { MobileNavDrawer } from "@/components/chrome/MobileNavDrawer";

/**
 * The persistent top navigation: one component, two variants driven by a prop so
 * there is no second nav to keep in sync. `full` is the content-page bar -- the
 * wordmark carries its "playground" label and an "Open playground" call to action
 * sits in the actions cluster. `slim` is the playground bar -- no label, no CTA,
 * and a shorter desktop height so it never steals the debugger's vertical space.
 * Both reuse the same wordmark, route data, theme control, and mobile drawer; the
 * variant only toggles the label, the CTA, and the height. Under md the routes and
 * the GitHub link fold into the shared drawer, leaving the wordmark, a compact
 * theme control, and the drawer trigger.
 */
export function SiteNav({ variant }: { variant: "full" | "slim" }) {
  const pathname = usePathname();
  const full = variant === "full";

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
                <Link
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center px-3 font-sans text-[14px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                    active
                      ? "text-[var(--cyan)] [box-shadow:inset_0_-2px_0_0_var(--cyan)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {route.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="source on github"
            className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)] md:inline-flex"
          >
            <GitHubIcon className="h-4 w-4" />
          </a>

          <ThemeControl size="compact" />

          {full ? (
            <Link
              href="/playground"
              className="hidden min-h-[44px] items-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-4 font-sans text-[14px] font-medium text-[var(--on-cyan)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:[box-shadow:var(--ring)] lg:inline-flex"
            >
              Open playground
            </Link>
          ) : null}

          <MobileNavDrawer />
        </div>
      </div>
    </nav>
  );
}
