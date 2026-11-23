"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_NAME_CHARS, type SourceFile } from "@/lib/playground/file-map";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:multi-files";
// Helper files the last write displaced. Loading a program REPLACES the strip
// on purpose (a new program must not link another workspace's helpers), so
// the displaced files are kept here and can be restored.
const BACKUP_KEY = "aarch64-playground:multi-files-backup";
// Copies a load keeps beyond that: a helper it replaces under the same name,
// and what earlier loads displaced. Apart from the backup so that, when
// storage is full, they all go and the other two keys hold what they would
// without them.
const COPIES_KEY = "aarch64-playground:multi-files-copies";

function readStore(key: string): SourceFile[] {
  const raw = safeGetItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (f) => typeof f === "object" && typeof f.name === "string" && typeof f.body === "string",
      )
    ) {
      return parsed as SourceFile[];
    }
  } catch {
    // malformed or absent localStorage payload; fall through to the empty list.
  }
  return [];
}

function writeStore(key: string, files: SourceFile[]): boolean {
  return safeSetItem(key, JSON.stringify(files));
}

/** Write `key`; if storage has no room, the copies make way and it is tried again. */
function writeMakingRoom(key: string, files: SourceFile[]): boolean {
  if (writeStore(key, files)) return true;
  if (safeGetItem(COPIES_KEY) === null) return false;
  safeRemoveItem(COPIES_KEY);
  return writeStore(key, files);
}

/**
 * A file the write is about to lose: neither its name nor its body survives
 * into the new strip. Matching on either side keeps a rename (same body) and
 * an edit (same name) out of the backup, so a restore is offered only when
 * work was lost.
 */
function displacedBy(stored: SourceFile[], next: SourceFile[]): SourceFile[] {
  return stored.filter(
    (f) => !next.some((n) => n.name === f.name || n.body === f.body),
  );
}

function sameFile(a: SourceFile, b: SourceFile): boolean {
  return a.name === b.name && a.body === b.body;
}

/** `files` without repeats and without any `held` already holds. */
function unheld(files: SourceFile[], held: SourceFile[]): SourceFile[] {
  return files.filter(
    (f, i) => files.findIndex((g) => sameFile(g, f)) === i && !held.some((h) => sameFile(h, f)),
  );
}

/** `name`, or a free name for it when the strip uses it: stack.s comes back as 2-stack.s. */
function freeName(name: string, files: SourceFile[]): string {
  let candidate = name;
  for (let i = 2; files.some((f) => f.name === candidate); i++) {
    // A digit-led prefix keeps a valid name valid; the slice keeps it within the cap.
    candidate = `${i}-${name}`.slice(0, MAX_FILE_NAME_CHARS);
  }
  return candidate;
}

interface Kept {
  backup: SourceFile[];
  copies: SourceFile[];
}

/**
 * Store a write of `next` over `prev`. The strip and the backup are written
 * as they always were; a load also keeps, in the copies, every file it
 * replaces that the backup does not hold, and what the backup held before.
 * Returns what is kept and, for a load, the names of saved helpers it
 * replaces with no copy saved, which happens only when storage is full; such
 * a load keeps no copies, so it leaves storage as it always would.
 */
function store(
  prev: SourceFile[],
  next: SourceFile[],
  kept: Kept,
  load: boolean,
): Kept & { unsaved: string[] } {
  const saved = readStore(STORE_KEY);
  const displaced = displacedBy(prev, next);
  const backup = displaced.length > 0 ? displaced : kept.backup;
  let copies = kept.copies;
  if (!load && displaced.length > 0) {
    // Any other write that displaces files replaces the restore list, as always.
    safeRemoveItem(COPIES_KEY);
    copies = [];
  }
  if (displaced.length > 0) writeMakingRoom(BACKUP_KEY, displaced);
  writeMakingRoom(STORE_KEY, next);
  if (!load) {
    return { backup, copies: safeGetItem(COPIES_KEY) === null ? [] : copies, unsaved: [] };
  }
  // A file whose text the program brings back is not lost, whatever its name,
  // and a file it puts back unchanged needs no copy.
  const replaced = prev.filter((f) => !next.some((n) => n.body === f.body));
  const wanted = unheld(
    [...kept.copies, ...(displaced.length > 0 ? kept.backup : []), ...replaced],
    [...backup, ...next],
  );
  copies = [];
  if (wanted.length > 0 && writeStore(COPIES_KEY, wanted)) copies = wanted;
  else safeRemoveItem(COPIES_KEY);
  const storedBackup = readStore(BACKUP_KEY);
  const uncopied = (held: SourceFile[]) =>
    replaced
      .filter(
        (f) =>
          saved.some((s) => s.name === f.name) &&
          !storedBackup.some((b) => sameFile(b, f)) &&
          !held.some((c) => sameFile(c, f)),
      )
      .map((f) => f.name);
  if (uncopied(copies).length === 0) return { backup, copies, unsaved: [] };
  // A load that cannot copy every saved helper goes exactly as it always did.
  safeRemoveItem(COPIES_KEY);
  return { backup, copies: [], unsaved: uncopied([]) };
}

/** What a restore brings back, and the call that restores it. */
export interface SourceFilesBackup {
  count: number;
  restore: () => void;
  /** The saved helpers a load of `next` would replace with no copy saved; stores nothing. */
  unsavedBy: (next: SourceFile[]) => string[];
}

/**
 * The multi-file workspace's persisted state: the extra source files beside
 * main.asm, the write that replaces them (`{ load: true }` for a program
 * load, which returns the saved helpers it replaced with no copy), and the
 * backup of whatever writes discarded. MultiFileTabs renders this state; it
 * does not own it.
 */
export function useSourceFiles(): [
  SourceFile[],
  (next: SourceFile[], how?: { load: boolean }) => string[],
  SourceFilesBackup,
] {
  const [files, setFiles] = useState<SourceFile[]>(() => readStore(STORE_KEY));
  const [kept, setKept] = useState<Kept>(() => ({
    backup: readStore(BACKUP_KEY),
    copies: readStore(COPIES_KEY),
  }));
  // The strip and the restore list as the last write left them. The backup is
  // decided by comparing the incoming set against these, at the moment of the
  // write, not in an effect, where the comparison would be a cascading render.
  const filesRef = useRef<SourceFile[]>(files);
  const keptRef = useRef<Kept>(kept);
  const save = useCallback((next: SourceFile[], how?: { load: boolean }) => {
    const { unsaved, ...after } = store(filesRef.current, next, keptRef.current, how?.load === true);
    filesRef.current = next;
    keptRef.current = after;
    setFiles(next);
    setKept(after);
    return unsaved;
  }, []);
  const unsavedBy = useCallback((next: SourceFile[]) => {
    const keys = [STORE_KEY, BACKUP_KEY, COPIES_KEY];
    const before = keys.map((k) => safeGetItem(k));
    const { unsaved } = store(filesRef.current, next, keptRef.current, true);
    // Put every key back as it was, the ones that shrink first: storage held
    // all three before, so each later write has the room it needs.
    safeRemoveItem(COPIES_KEY);
    const grows = (i: number) => (before[i] ?? "").length - (safeGetItem(keys[i]) ?? "").length;
    for (const i of [0, 1, 2].sort((a, b) => grows(a) - grows(b))) {
      const value = before[i];
      if (value === null) safeRemoveItem(keys[i]);
      else safeSetItem(keys[i], value);
    }
    return unsaved;
  }, []);
  // Restoring APPENDS: the program that replaced the strip may need its own
  // helpers, so bringing the old ones back must not take theirs away. One
  // whose name the strip now uses comes back under a free name.
  const restore = useCallback(() => {
    const next = [...filesRef.current];
    for (const f of [...keptRef.current.copies, ...keptRef.current.backup]) {
      if (!next.some((n) => sameFile(n, f))) next.push({ name: freeName(f.name, next), body: f.body });
    }
    safeRemoveItem(COPIES_KEY);
    writeStore(BACKUP_KEY, []);
    writeStore(STORE_KEY, next);
    const after = { backup: [], copies: [] };
    filesRef.current = next;
    keptRef.current = after;
    setFiles(next);
    setKept(after);
  }, []);
  return [files, save, { count: kept.backup.length + kept.copies.length, restore, unsavedBy }];
}
