/**
 * The shared order comparator for content cards (lessons and exercises). Pure
 * and isomorphic (no node:fs, no React) so the server-only loaders and the
 * client indexes share one rule rather than each re-implementing it: two
 * numbers compare numerically, two strings via `localeCompare`, and a mixed
 * pair falls back to a string comparison so the sort is always total.
 */
export function compareByOrder(
  a: { order: number | string },
  b: { order: number | string },
): number {
  const x = a.order;
  const y = b.order;
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "string" && typeof y === "string") return x.localeCompare(y);
  return String(x).localeCompare(String(y));
}
