/**
 * Client-only persistence for the per-exercise solved set, stored as a JSON
 * string[] of slugs under a single localStorage key. The stored value is
 * treated as untrusted on read: a tampered, absent, or malformed value
 * degrades to "nothing solved" rather than throwing. Every function is
 * SSR-safe (guards `typeof window`) and never throws, even when
 * localStorage is absent or throwing (private mode, sandboxed iframe,
 * quota), through the shared safe-storage helpers.
 *
 * The index reads this set and re-renders when it changes; the exercise
 * view writes to it when a check passes. The index also exports the set as
 * a versioned json file and imports one back: a browser that evicts
 * script-writable storage (Safari does, after seven days without a visit)
 * takes the set with it, and that file is the only way back.
 *
 * A same-tab CustomEvent plus the
 * native cross-tab "storage" event keep every open instance in sync (the
 * "storage" event fires only in OTHER tabs, so the same-tab event is what
 * updates the tab that did the writing).
 */

import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const SOLVED_KEY = "aarch64-playground:practice:solved";
/** Same-tab change signal; the native "storage" event covers other tabs only. */
const SOLVED_EVENT = "aarch64-playground:practice:solved";

/**
 * The solved slugs, parsed defensively: absent, non-JSON, or a value that
 * is not an array of strings all degrade to an empty list.
 */
export function getSolvedSlugs(): string[] {
  const raw = safeGetItem(SOLVED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed as string[];
    }
  } catch {
    // malformed; treat as nothing solved.
  }
  return [];
}

/** Whether a slug has been recorded as solved. */
export function isSolved(slug: string): boolean {
  return getSolvedSlugs().includes(slug);
}

/**
 * Persist a new set and announce it in this tab. The announcement is what
 * keeps an open index live; the native "storage" event only reaches other
 * tabs. Every writer goes through here so a new one cannot forget it.
 */
function writeSolved(slugs: string[]): void {
  safeSetItem(SOLVED_KEY, JSON.stringify(slugs));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SOLVED_EVENT));
  }
}

/**
 * Record a slug as solved. Idempotent: a slug already present is a no-op,
 * so callers can mark on every passing check without creating duplicates.
 */
export function markSolved(slug: string): void {
  const current = getSolvedSlugs();
  if (current.includes(slug)) return;
  writeSolved([...current, slug]);
}

/**
 * Subscribe to solved-set changes. The callback fires on a same-tab
 * markSolved (via the CustomEvent) and on a change in another tab (via the
 * native "storage" event). Returns an unsubscribe that removes both
 * listeners; a no-op on the server where there is no window.
 */
export function subscribeSolved(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === SOLVED_KEY) callback();
  };
  const onSameTab = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SOLVED_EVENT, onSameTab);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SOLVED_EVENT, onSameTab);
  };
}

/** The exported shape: versioned so a later format can be told apart. */
export interface ProgressBundle {
  version: 1;
  solved: string[];
}

export type ProgressImportResult =
  | { ok: true; added: number; total: number }
  | { ok: false; error: string };

/**
 * Entries a bundle may carry, and the length of one. The catalog is a few
 * dozen exercises, so these are generous; they exist to bound a hostile
 * file, not to bound a real one.
 */
const MAX_BUNDLE_ENTRIES = 256;
const MAX_SLUG_CHARS = 64;

/** The current solved set as a downloadable bundle. An empty set is valid. */
export function buildProgressBundle(): ProgressBundle {
  return { version: 1, solved: getSolvedSlugs() };
}

/**
 * Validate a parsed bundle field by field and UNION it into the stored set.
 * Importing only ever adds: a student who solved something on this device
 * and imports an older file keeps what the file does not know about.
 * Unknown slugs are kept as written, so a bundle from a newer catalog
 * survives a round trip through an older build.
 *
 * A malformed bundle fails closed with a student-facing reason and writes
 * nothing at all -- a partial import would leave the student unable to say
 * what actually landed.
 */
export function importProgressBundle(raw: unknown): ProgressImportResult {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "that file is not a progress export" };
  }
  const bundle = raw as { version?: unknown; solved?: unknown };
  if (bundle.version !== 1) {
    return { ok: false, error: "that progress file has an unrecognized version" };
  }
  if (!Array.isArray(bundle.solved)) {
    return { ok: false, error: "that progress file has no list of solved exercises" };
  }
  if (bundle.solved.length > MAX_BUNDLE_ENTRIES) {
    return {
      ok: false,
      error: `that progress file lists too many exercises (max ${MAX_BUNDLE_ENTRIES})`,
    };
  }
  const incoming: string[] = [];
  for (const entry of bundle.solved) {
    if (typeof entry !== "string") {
      return { ok: false, error: "that progress file has an entry that is not a name" };
    }
    const slug = entry.trim();
    if (slug.length === 0) {
      return { ok: false, error: "that progress file has an empty entry" };
    }
    if (slug.length > MAX_SLUG_CHARS) {
      return {
        ok: false,
        error: `that progress file has an entry longer than ${MAX_SLUG_CHARS} characters`,
      };
    }
    incoming.push(slug);
  }
  const merged = getSolvedSlugs();
  const seen = new Set(merged);
  let added = 0;
  for (const slug of incoming) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    merged.push(slug);
    added += 1;
  }
  // Nothing new means nothing to persist and nothing to announce, the same
  // way a repeated markSolved is a no-op.
  if (added > 0) writeSolved(merged);
  return { ok: true, added, total: merged.length };
}
