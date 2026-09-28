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

// Vercel keeps the fetch cache between builds, which would freeze the count
// at the first build. The deployment id in the query (GitHub ignores it) gives
// each deploy a fresh read; a commit key would not, since a deploy hook
// rebuilds the same commit.
const STARS_URL = `${STARS_ENDPOINT}?deploy=${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}`;

/**
 * Server-only: the current stargazer count, or null when the count cannot be
 * trusted. Null covers a non-ok response, a thrown request, a payload without a
 * numeric stargazers_count, and a count of zero: a visible "0" reads as a
 * broken widget.
 */
export async function fetchStarCount(): Promise<number | null> {
  try {
    const response = await fetch(STARS_URL, {
      headers: { Accept: "application/vnd.github+json" },
      // Read once per build so every route stays a static file; the
      // refresh-stars workflow deploys on each new star and weekly. A
      // revalidate here would make the server regenerate every page.
      cache: "force-cache",
      // A slow GitHub must not stall the build; a timeout falls back to the icon.
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
