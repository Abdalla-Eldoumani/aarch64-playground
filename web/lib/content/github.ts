// The repository's star count for the nav, read on the server. No token: the
// count is public. Any failure returns null and the nav shows the icon alone.

import { REPO_URL } from "@/lib/content/site";

const STARS_ENDPOINT = `https://api.github.com/repos/${REPO_URL.replace(
  "https://github.com/",
  "",
)}`;

// Vercel keeps the fetch cache between builds, so the deployment id (GitHub
// ignores it) makes each deploy read afresh; a deploy hook rebuilds the same
// commit, so a commit key would not.
const STARS_URL = `${STARS_ENDPOINT}?deploy=${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}`;

/** The stargazer count, or null; a count of zero is null too, since "0" looks broken. */
export async function fetchStarCount(): Promise<number | null> {
  try {
    const response = await fetch(STARS_URL, {
      headers: { Accept: "application/vnd.github+json" },
      // Once per build keeps every route static; a revalidate would make
      // every page an ISR page.
      cache: "force-cache",
      // A slow GitHub must not stall the build.
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
    // The icon-only nav is the whole error handling; a log line per failed
    // read would only flood the logs.
    return null;
  }
}

/** Exact below a thousand, then one decimal without a bare .0: 1000 is "1k", 1204 "1.2k". */
export function formatStarCount(n: number): string {
  if (n < 1000) return String(n);
  const thousands = (n / 1000).toFixed(1);
  return `${thousands.endsWith(".0") ? thousands.slice(0, -2) : thousands}k`;
}
