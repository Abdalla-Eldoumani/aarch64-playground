"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REPO_URL, NAV_ROUTES, isActiveRoute } from "@/lib/content/site";
import { formatStarCount } from "@/lib/content/github";
import { CloseIcon, GitHubIcon, MenuIcon } from "@/components/chrome/SiteIcons";
import { ThemeControl } from "@/components/chrome/ThemeControl";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

/**
 * The collapsed mobile navigation: a hamburger trigger that opens an accessible
 * slide-in drawer of the site routes plus the theme control. Hidden at md and up
 * (the wide layout shows the routes inline), so the root carries `md:hidden`.
 * Focus trapping, Escape, and focus return come from the shared useFocusTrap hook.
 *
 * `stars` arrives from SiteNav, which only has it on the server-rendered mounts;
 * without it the source row shows no count.
 */
export function MobileNavDrawer({ stars = null }: { stars?: number | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const starCount = stars === null ? null : formatStarCount(stars);

  useFocusTrap(open, panelRef, () => setOpen(false));

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "close navigation" : "open navigation"}
        className="relative z-[80] inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Portaled to <body>: the nav's backdrop-blur makes the nav the
          containing block for fixed descendants, which would clip the
          full-height overlay to the nav band. */}
      {open ? (
        createPortal(
          <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[65] bg-black/60"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="site navigation"
            className="anim-modal-rise fixed inset-y-0 right-0 z-[70] flex w-[min(20rem,85vw)] flex-col gap-1 border-l border-[var(--border-strong)] bg-[var(--bg-panel)] p-4 pt-[calc(var(--safe-top)+1rem)] [box-shadow:var(--shadow-overlay)]"
          >
            <nav aria-label="mobile" className="flex flex-col gap-1">
              {NAV_ROUTES.map((route) => {
                const active = isActiveRoute(pathname, route.href);
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[44px] items-center rounded-[var(--radius-control)] px-3 font-sans text-[15px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] ${
                      active
                        ? "text-[var(--cyan)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {route.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-2 border-t border-[var(--border)] pt-3">
              <ThemeControl size="comfortable" />
            </div>

            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={
                stars === null
                  ? "source on github"
                  : `source on github, ${stars} ${stars === 1 ? "star" : "stars"}`
              }
              className="mt-1 flex min-h-[44px] items-center gap-2 rounded-[var(--radius-control)] px-3 font-sans text-[14px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
            >
              <GitHubIcon className="h-4 w-4" />
              <span>source on github</span>
              {/* Same tertiary mono numeral as the wide bar, appended inside the
                  same anchor so the row stays one target. */}
              {starCount === null ? null : (
                <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                  {starCount}
                </span>
              )}
            </a>
          </div>
        </>,
          document.body,
        )
      ) : null}
    </div>
  );
}
