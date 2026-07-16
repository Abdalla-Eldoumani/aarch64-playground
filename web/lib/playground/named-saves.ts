"use client";

/**
 * Named bookmarks persisted across page loads. A bookmark captures
 * the input state needed to re-reach a particular step in execution:
 * source + args + stdin + step count. Restore re-assembles the source
 * and steps the live CPU forward to `stepCount`.
 *
 * The Rust snapshot ring still holds the in-memory CPU state for
 * step-back; bookmarks are intentionally a different mechanism so
 * they survive page reloads, can be exported / imported, and don't
 * grow as large as raw register + memory dumps.
 */
export interface NamedSave {
  name: string;
  source: string;
  args?: string;
  stdin?: string;
  stepCount: number;
  /** ISO-8601 timestamp; the UI sorts by this when present. */
  savedAt: string;
}

export interface SaveBundle {
  version: 1;
  saves: NamedSave[];
}

const STORAGE_KEY = "aarch64-playground:named-saves";
export const SAVES_CHANGED_EVENT = "aarch64-playground:named-saves-changed";

function readAll(): NamedSave[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSave);
  } catch {
    return [];
  }
}

function writeAll(saves: NamedSave[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    window.dispatchEvent(new CustomEvent(SAVES_CHANGED_EVENT));
  } catch {
    // ignore quota / private mode failures
  }
}

function isValidSave(v: unknown): v is NamedSave {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    o.name.length > 0 &&
    typeof o.source === "string" &&
    typeof o.stepCount === "number" &&
    // An imported bundle is untrusted: a 1e12 or negative count passed
    // the bare typeof check and drove the restore loop unbounded.
    Number.isInteger(o.stepCount) &&
    o.stepCount >= 0 &&
    o.stepCount <= 10_000_000 &&
    typeof o.savedAt === "string"
  );
}

export function listSaves(): NamedSave[] {
  return readAll();
}

export function getSave(name: string): NamedSave | null {
  return readAll().find((s) => s.name === name) ?? null;
}

export function putSave(save: NamedSave): void {
  const all = readAll();
  const idx = all.findIndex((s) => s.name === save.name);
  if (idx >= 0) all[idx] = save;
  else all.push(save);
  writeAll(all);
}

export function removeSave(name: string): void {
  const all = readAll().filter((s) => s.name !== name);
  writeAll(all);
}

export function clearSaves(): void {
  writeAll([]);
}

export function exportBundle(): SaveBundle {
  return { version: 1, saves: readAll() };
}

/**
 * Validate + merge a foreign bundle. Existing names take precedence
 * (no clobber). Returns a count of added vs skipped.
 */
export function importBundle(bundle: unknown): { added: number; skipped: number } {
  if (
    bundle == null ||
    typeof bundle !== "object" ||
    (bundle as { version?: unknown }).version !== 1 ||
    !Array.isArray((bundle as { saves?: unknown }).saves)
  ) {
    return { added: 0, skipped: 0 };
  }
  const existing = readAll();
  const existingNames = new Set(existing.map((s) => s.name));
  let added = 0;
  let skipped = 0;
  const incoming = (bundle as { saves: unknown[] }).saves;
  for (const candidate of incoming) {
    if (!isValidSave(candidate)) {
      skipped++;
      continue;
    }
    if (existingNames.has(candidate.name)) {
      skipped++;
      continue;
    }
    existing.push(candidate);
    existingNames.add(candidate.name);
    added++;
  }
  if (added > 0) writeAll(existing);
  return { added, skipped };
}
