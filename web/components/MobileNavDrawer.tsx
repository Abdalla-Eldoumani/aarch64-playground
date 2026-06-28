"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { REPO_URL, NAV_ROUTES, isActiveRoute } from "@/lib/site";
import { CloseIcon, GitHubIcon, MenuIcon } from "@/components/SiteIcons";
import { ThemeControl } from "@/components/ThemeControl";
import { useFocusTrap } from "@/lib/use-focus-trap";

/**
 * The collapsed mobile navigation: a hamburger trigger that opens an accessible
 * slide-in drawer of the site routes plus the theme control. Hidden at md and up
 * (the wide layout shows the routes inline), so the root carries `md:hidden`.
 * Focus management, Tab cycling, Escape, and focus-return all come from the shared
 * useFocusTrap hook rather than a hand-rolled trap.
 */
export function MobileNavDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useFocusTrap(open, panelRef, () => setOpen(false));

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "close navigation" : "open navigation"}
        className="relative z-[60] inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/60"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="site navigation"
            className="anim-modal-rise fixed inset-y-0 right-0 z-50 flex w-[min(20rem,85vw)] flex-col gap-1 border-l border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-overlay)]"
          >
            <nav className="flex flex-col gap-1">
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
              aria-label="source on github"
              className="mt-1 flex min-h-[44px] items-center gap-2 rounded-[var(--radius-control)] px-3 font-sans text-[14px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
            >
              <GitHubIcon className="h-4 w-4" />
              <span>source on github</span>
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
