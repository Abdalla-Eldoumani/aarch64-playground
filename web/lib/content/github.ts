// The repository's star count, read on the server and threaded into the nav as a
// prop. Public REST, no token: the count is public data, and a credential in a
// client-rendered app has nowhere safe to live. Every failure path returns null
// so the nav falls back to the icon-only link.

import { REPO_URL } from "@/lib/content/site";

// The REST path mirrors the repository path, so owner/repo comes off the one
// source for the repository address instead of being restated here.
const STARS_ENDPOINT = `https://api.github.com/repos/${REPO_URL.replace(
  "https://github.com/",
  "",
)}`;

/**
 * Server-only: the current stargazer count, or null when the count cannot be
 * trusted. Null covers a non-ok response, a thrown request, a payload without a
 * numeric stargazers_count, and a count of zero: a visible "0" reads as a
 * broken widget,
 */
export async function fetchStarCount(): Promise<number | null> {
  try {
    const response = await fetch(STARS_ENDPOINT, {
      headers: { Accept: "application/vnd.github+json" },
      // Read once per build and baked into the prerendered pages, so every
      // route stays a static file and no visitor request ever reaches this
      // call. A stale count is harmless: it refreshes on the next deploy, and
      // dependabot's weekly bumps deploy at least that often. A revalidate
      // interval here would turn every route that renders the nav into an
      // ISR page regenerated on the server.
      cache: "force-cache",
      // A hanging GitHub must never stall a prerender: this fetch runs inside
      // the build of every content route, and the catch below already renders
      // the icon-only fallback on a timeout.
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    const count = (payload as { stargazers_count?: unknown } | null)
      ?.stargazers_count;
    // Number.isFinite also rejects NaN, which typeof calls a number.
    if (typeof count !== "number" || !Number.isFinite(count) || count < 1) {
      return null;
    }
    return count;
  } catch {
    // Silent by design: the fallback rendering is the whole error handling, and
    // a lookup that fails on every request would otherwise flood the logs.
    return null;
  }
}

/**
 * Star counts as the nav shows them: exact below a thousand, one decimal above
 * with a bare .0 dropped (1000 -> "1k", 1204 -> "1.2k", 12100 -> "12.1k").
 */
export function formatStarCount(n: number): string {
  if (n < 1000) return String(n);
  const thousands = (n / 1000).toFixed(1);
  return `${thousands.endsWith(".0") ? thousands.slice(0, -2) : thousands}k`;
}
