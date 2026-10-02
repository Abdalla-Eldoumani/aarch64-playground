"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REPO_URL, NAV_ROUTES, isActiveRoute } from "@/lib/content/site";
import { formatStarCount } from "@/lib/content/github";
import { CloseIcon, GitHubIcon, MenuIcon } from "@/components/chrome/SiteIcons";
import { ThemeControl } from "@/components/chrome/ThemeControl";
import { SaveOffline } from "@/components/chrome/SaveOffline";
import { closeOnBackdropClick, useFocusTrap } from "@/lib/hooks/use-focus-trap";

/**
 * The phone menu, hidden at md and up where the wide bar shows the routes
 * inline. `everywhere` keeps it at every width, for the short-window
 * playground band that stands in for the site bar. `stars` comes from SiteNav,
 * which has it only on server-rendered mounts; without it the source row
 * shows no count.
 */
export function MobileNavDrawer({
  stars = null,
  everywhere = false,
}: {
  stars?: number | null;
  everywhere?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const starCount = stars === null ? null : formatStarCount(stars);

  // A dismissal hands focus to the toggle itself: WebKit does not focus a
  // button it taps, so the trap may have only <body> to give back. A route
  // link closes the drawer without it.
  const refocusToggle = useRef(false);
  const dismiss = () => {
    refocusToggle.current = true;
    setOpen(false);
  };
  useEffect(() => {
    if (open || !refocusToggle.current) return;
    refocusToggle.current = false;
    toggleRef.current?.focus();
  }, [open]);

  // The page behind the drawer stays put, as behind every other dialog.
  useEffect(() => {
    if (!open) return;
    const { style } = document.body;
    const before = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = before;
    };
  }, [open]);

  useFocusTrap(open, panelRef, dismiss);

  return (
    <div className={everywhere ? undefined : "md:hidden"}>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "close navigation" : "open navigation"}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        <MenuIcon />
      </button>

      {/* Portaled to <body>: the nav's backdrop-blur makes the nav the
          containing block for fixed descendants, which would clip the
          full-height overlay to the nav band. */}
      {open ? (
        createPortal(
          <>
          <div
            aria-hidden="true"
            onClick={(e) => closeOnBackdropClick(dismiss)(e)}
            className="fixed inset-0 z-[65] bg-black/60"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="site navigation"
            className="anim-modal-rise fixed inset-y-0 right-0 z-[70] flex w-[min(20rem,85vw)] flex-col gap-1 overflow-y-auto overscroll-contain border-l border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 pb-4 pt-[var(--safe-top)] [box-shadow:var(--shadow-overlay)]"
          >
            {/* The panel covers the toggle, so its close button takes the
                toggle's spot: a 56px row and the bar's 16px edge put the two
                centres together, and a second tap there closes. */}
            <div className="flex h-14 shrink-0 items-center justify-end">
              <button
                type="button"
                onClick={dismiss}
                aria-label="close navigation"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
              >
                <CloseIcon />
              </button>
            </div>
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

            <SaveOffline className="mt-1 px-3" />

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
                <span className="font-mono text-[12px] tabular-nums text-[var(--text-tertiary)]">
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
