"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPO_URL, NAV_ROUTES, isActiveRoute } from "@/lib/site";
import { Wordmark } from "@/components/Wordmark";
import { GitHubIcon } from "@/components/SiteIcons";
import { ThemeControl } from "@/components/ThemeControl";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";

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
      className={`w-full border-b border-[var(--border)] bg-[var(--bg-base)] ${
        full ? "h-14 md:h-16" : "h-14 md:h-12"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-screen-xl items-center justify-between gap-3 px-4">
        <Wordmark showLabel={full} />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ROUTES.map((route) => {
            const active = isActiveRoute(pathname, route.href);
            return (
              <li key={route.href}>
                <Link
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] px-3 font-sans text-[14px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                    active
                      ? "text-[var(--cyan)] [box-shadow:inset_0_-2px_0_0_var(--cyan)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
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
              href="/"
              className="hidden min-h-[44px] items-center rounded-[var(--radius-control)] bg-[var(--cyan)] px-4 font-sans text-[14px] font-medium text-[var(--on-cyan)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:[box-shadow:var(--ring)] md:inline-flex"
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
