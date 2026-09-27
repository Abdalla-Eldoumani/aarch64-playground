"use client";

import { useState, useSyncExternalStore } from "react";
import { CloseIcon } from "@/components/chrome/SiteIcons";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const DISMISSED_KEY = "aarch64-playground:install-hint-dismissed";

/**
 * Whether this visit is Safari on an iPhone or iPad, outside an installed
 * copy, with the tip not yet dismissed. iOS offers no install prompt of its
 * own, so without the tip a student never learns the playground can live on
 * the home screen and run offline. iPadOS reports itself as a Mac, so a Mac
 * with a touch screen counts too. Other iOS browsers and in-app views are left
 * out: their menus differ, and an in-app view cannot install at all.
 */
function wantsHint(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/.test(ua);
  const installed =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return ios && safari && !installed && safeGetItem(DISMISSED_KEY) !== "1";
}

function subscribe(): () => void {
  return () => {};
}

/** A one-time tip on iOS Safari: how to add the site to the home screen. */
export function InstallHint() {
  // False on the server and in the hydration pass, so the markup matches.
  const eligible = useSyncExternalStore(subscribe, wantsHint, () => false);
  const [dismissed, setDismissed] = useState(false);
  if (!eligible || dismissed) return null;

  return (
    <aside
      aria-label="install tip"
      className="fixed inset-x-3 bottom-[calc(0.75rem+var(--safe-bottom))] z-40 flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] py-2 pl-4 pr-1 [box-shadow:var(--shadow-overlay)] sm:left-auto sm:w-[24rem]"
    >
      <p className="flex-1 py-1.5 font-sans text-[14px] leading-snug text-[var(--text-primary)]">
        Add the playground to your home screen: tap Share, then Add to Home Screen. It opens full
        screen and works offline.
      </p>
      <button
        type="button"
        onClick={() => {
          safeSetItem(DISMISSED_KEY, "1");
          setDismissed(true);
        }}
        aria-label="dismiss the install tip"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]"
      >
        <CloseIcon />
      </button>
    </aside>
  );
}
