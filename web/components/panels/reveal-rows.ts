/** The host's pane: the nearest ancestor that can scroll, short of the page,
 *  which is never ours to move. */
export function hostPane(from: HTMLElement): HTMLElement | null {
  const page = document.scrollingElement;
  for (let el = from.parentElement; el; el = el.parentElement) {
    if (el === page || el === document.body) return null;
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
  }
  return null;
}

/**
 * Scroll just far enough to show all of `rows`, or the first of them when
 * they cannot all fit: inside the list's own box, then inside the host's
 * pane when that pane is too short to show the list whole (a lesson frame on
 * a phone). Nothing moves when they are already in view. `scrollIntoView`
 * would also scroll the page.
 */
export function revealRows(body: HTMLElement, rows: readonly Element[], smooth: boolean): void {
  if (rows.length === 0) return;
  const rects = rows.map((row) => row.getBoundingClientRect());
  let first = Math.min(...rects.map((r) => r.top));
  let last = Math.max(...rects.map((r) => r.bottom));
  for (const box of [body, hostPane(body)]) {
    if (!box || box.scrollHeight <= box.clientHeight) continue;
    const top = box.getBoundingClientRect().top + box.clientTop;
    const bottom = top + box.clientHeight;
    // A pixel of slack: fractional layout can leave a fully shown row a
    // hair outside the box.
    if (first >= top - 1 && last <= bottom + 1) continue;
    const delta = first < top || last - first > bottom - top ? first - top : last - bottom;
    const from = box.scrollTop;
    const target = Math.min(Math.max(from + delta, 0), box.scrollHeight - box.clientHeight);
    box.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
    // A smooth scroll has not moved the rows yet, so the pane works from
    // where they will land.
    first -= target - from;
    last -= target - from;
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
