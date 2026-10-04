/**
 * The solved exercises, kept in localStorage. A stored value that is missing
 * or broken reads as "nothing solved", and nothing here throws, even where
 * storage is blocked (private mode, a sandboxed iframe, a full quota).
 *
 * Safari clears script-written storage after seven days without a visit, so
 * the index can export the set, with the saved answers, as a json file and
 * import it back.
 */

import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";
import {
  MAX_ANSWER_CHARS,
  putAnswer,
  readAllAnswers,
  readAnswer,
  validateAnswer,
  type StoredAnswer,
} from "@/lib/playground/exercise-answers";

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

/**
 * `answers` came later and stays optional at version 1, so an older build
 * ignores it and a file without it still imports.
 */
export interface ProgressBundle {
  version: 1;
  solved: string[];
  answers?: Record<string, StoredAnswer>;
}

export type ProgressImportResult =
  | { ok: true; added: number; total: number; answersAdded: number }
  | { ok: false; error: string };

/** Generous next to a few dozen exercises: they bound a hostile file, not a real one. */
const MAX_BUNDLE_ENTRIES = 256;
const MAX_SLUG_CHARS = 64;

/** The current solved set and saved work as a downloadable bundle. An empty one is valid. */
export function buildProgressBundle(): ProgressBundle {
  return { version: 1, solved: getSolvedSlugs(), answers: readAllAnswers() };
}

/**
 * A file's answer replaces a local one only when strictly newer, so importing
 * an old export keeps the work in front of the student. A bad entry is
 * skipped; the rest of the file still lands.
 */
function mergeAnswers(raw: Record<string, unknown>): number {
  let added = 0;
  for (const [slug, entry] of Object.entries(raw)) {
    if (slug.length === 0 || slug.length > MAX_SLUG_CHARS) continue;
    const answer = validateAnswer(entry);
    if (!answer) continue;
    if (JSON.stringify(answer).length > MAX_ANSWER_CHARS) continue;
    const local = readAnswer(slug);
    if (local && local.updatedAt >= answer.updatedAt) continue;
    if (putAnswer(slug, answer)) added += 1;
  }
  return added;
}

/**
 * Importing only adds, so an older file cannot undo work done on this device.
 * Unknown slugs are kept so a file from a newer catalog survives an older
 * build. A malformed file writes nothing, since a partial import would leave
 * the student unsure what landed; only a single bad answer is skipped.
 */
export function importProgressBundle(raw: unknown): ProgressImportResult {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "that file is not a progress export" };
  }
  const bundle = raw as { version?: unknown; solved?: unknown; answers?: unknown };
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
  // The answers map is optional (a file written before them has none), but a
  // present one has to be a map: only its entries are allowed to be skipped.
  let answers: Record<string, unknown> = {};
  if (bundle.answers !== undefined) {
    if (bundle.answers == null || typeof bundle.answers !== "object" || Array.isArray(bundle.answers)) {
      return { ok: false, error: "that progress file has a malformed answers section" };
    }
    answers = bundle.answers as Record<string, unknown>;
    if (Object.keys(answers).length > MAX_BUNDLE_ENTRIES) {
      return {
        ok: false,
        error: `that progress file lists too many exercises (max ${MAX_BUNDLE_ENTRIES})`,
      };
    }
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
  return { ok: true, added, total: merged.length, answersAdded: mergeAnswers(answers) };
}
