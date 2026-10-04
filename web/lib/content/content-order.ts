/**
 * The sort rule for lessons and exercises. It imports nothing, so the
 * server-only loaders and the client indexes share it. A mixed number and
 * string pair compares as strings so the sort is always total.
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
