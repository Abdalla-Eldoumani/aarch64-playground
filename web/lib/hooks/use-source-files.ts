"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_NAME_CHARS, type SourceFile } from "@/lib/playground/file-map";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:multi-files";
// Helper files that writes displaced. Loading a program REPLACES the strip on
// purpose (a new program must not link another workspace's helpers), so the
// displaced files are kept here, from every load since the last restore.
const BACKUP_KEY = "aarch64-playground:multi-files-backup";

/**
 * A helper file as storage holds it. `link` marks one a program load brought
 * (a share link, a diagnostic link or an example) that has not been changed
 * since. Any other file is the student's, and so is every file stored before
 * the mark existed: a full store may drop copies of link files to make room,
 * never the student's.
 */
type Stored = SourceFile & { link?: true };

/** What a write did: stored, shown but not stored, or (a load only) not done. */
export type FilesWrite = "stored" | "unsaved" | "refused";

function readStore(key: string): Stored[] {
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
      return (parsed as Stored[]).map(({ name, body, link }) =>
        link === true ? { name, body, link } : { name, body },
      );
    }
  } catch {
    // malformed or absent localStorage payload; fall through to the empty list.
  }
  return [];
}

function writeStore(key: string, files: Stored[]): boolean {
  return safeSetItem(key, JSON.stringify(files));
}

/**
 * Store `files` as the backup, dropping the oldest copies of link files until
 * it fits. Returns what was stored, or null with the stored backup unchanged.
 */
function storeBackup(files: Stored[]): Stored[] | null {
  let left = files;
  while (!writeStore(BACKUP_KEY, left)) {
    const oldest = left.findIndex((f) => f.link);
    if (oldest < 0) return null;
    left = left.filter((_, i) => i !== oldest);
  }
  return left;
}

/**
 * Store the strip, dropping the oldest copies of link files from `backup` to
 * make room. Returns the backup now stored, or null if the strip did not fit.
 */
function storeStrip(strip: Stored[], backup: Stored[]): Stored[] | null {
  let left = backup;
  while (!writeStore(STORE_KEY, strip)) {
    const oldest = left.findIndex((f) => f.link);
    if (oldest < 0) return null;
    left = left.filter((_, i) => i !== oldest);
    if (!writeStore(BACKUP_KEY, left)) return null;
  }
  return left;
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

/** `files` as storage holds them, each marked when it is one of `links`. */
function markLinks(files: SourceFile[], links: SourceFile[]): Stored[] {
  return files.map(({ name, body }) =>
    links.some((l) => l.name === name && l.body === body) ? { name, body, link: true } : { name, body },
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

/** How many displaced helper files the backup holds, and the call that
 * restores them. */
export interface SourceFilesBackup {
  count: number;
  restore: () => void;
}

/**
 * The multi-file workspace's persisted state: the extra source files beside
 * main.asm, the write that replaces them (`{ load: true }` for a program
 * load), and the backup of whatever writes discarded. MultiFileTabs renders
 * this state; it does not own it.
 */
export function useSourceFiles(): [
  SourceFile[],
  (next: SourceFile[], how?: { load: boolean }) => FilesWrite,
  SourceFilesBackup,
] {
  const [start] = useState(() => ({ strip: readStore(STORE_KEY), backup: readStore(BACKUP_KEY) }));
  const [files, setFiles] = useState<SourceFile[]>(() =>
    start.strip.map(({ name, body }) => ({ name, body })),
  );
  // What a restore brings back: the stored backup, then the kept files.
  const [offer, setOffer] = useState<Stored[]>(start.backup);
  // The strip on screen. Writes compare against it at the moment of the
  // write, not in an effect, where the comparison would be a cascading render.
  const filesRef = useRef<SourceFile[]>(files);
  // What each key holds; a write storage refuses leaves these as they were.
  const storedRef = useRef<Stored[]>(start.strip);
  const backupRef = useRef<Stored[]>(start.backup);
  // The unchanged files of the last load, which mark a file as from a link.
  const fromLinkRef = useRef<SourceFile[]>(start.strip.filter((f) => f.link));
  // Stored files a load took off the screen without room for their copies.
  // The stored strip still holds them, so no write replaces it until they
  // come back on screen.
  const keptRef = useRef<Stored[]>([]);

  const show = useCallback((next: SourceFile[]) => {
    filesRef.current = next;
    setFiles(next);
    setOffer([...backupRef.current, ...keptRef.current]);
  }, []);

  const save = useCallback(
    (next: SourceFile[], how?: { load: boolean }): FilesWrite => {
      if (!how?.load) {
        const displaced = markLinks(displacedBy(filesRef.current, next), fromLinkRef.current);
        show(next);
        if (keptRef.current.length > 0) return "unsaved";
        if (displaced.length > 0 && writeStore(BACKUP_KEY, displaced)) {
          backupRef.current = displaced;
          setOffer(displaced);
        }
        const strip = markLinks(next, fromLinkRef.current);
        if (!writeStore(STORE_KEY, strip)) return "unsaved";
        storedRef.current = strip;
        return "stored";
      }

      // Everything the load takes off the screen or out of the stored strip
      // that it does not bring back and the backup does not already hold.
      const screen = markLinks(filesRef.current, fromLinkRef.current);
      const atRisk = [...screen, ...keptRef.current].filter(
        (f, i, all) =>
          all.findIndex((g) => sameFile(g, f)) === i &&
          !next.some((n) => n.body === f.body) &&
          !backupRef.current.some((k) => sameFile(k, f)),
      );
      // A file the load delivers unchanged is from a link, unless the student
      // already had that very file.
      const own = [...screen, ...keptRef.current].filter((f) => !f.link);
      const fromLink = next.filter((n) => !own.some((o) => sameFile(o, n)));
      const strip = markLinks(next, fromLink);
      const stored = storedRef.current;
      const before = safeGetItem(BACKUP_KEY);
      const wanted = [...backupRef.current, ...atRisk];

      // The copies go first, while the old strip still holds the originals.
      let backup = atRisk.length > 0 ? storeBackup(wanted) : backupRef.current;
      let landed = false;
      let putBackFailed = false;
      if (!backup && JSON.stringify(strip).length < JSON.stringify(stored).length) {
        // A smaller strip makes room for the copies; if they still do not
        // fit, the old strip goes back.
        if (writeStore(STORE_KEY, strip)) {
          backup = storeBackup(wanted);
          landed = backup !== null;
          if (!backup && !writeStore(STORE_KEY, stored)) {
            storedRef.current = strip;
            putBackFailed = true;
          }
        }
      }
      if (backup && !landed) {
        const left = storeStrip(strip, backup);
        if (left) {
          backup = left;
          landed = true;
        } else {
          // The copies are not needed while the old strip stays.
          safeSetItem(BACKUP_KEY, before ?? "[]");
        }
      }

      if (landed && backup) {
        storedRef.current = strip;
        backupRef.current = backup;
        keptRef.current = [];
      } else {
        // A student's file that only the screen holds would be lost.
        const screenOnly = atRisk.some(
          (f) => !f.link && !stored.some((s) => sameFile(s, f)),
        );
        if (screenOnly || putBackFailed) return "refused";
        keptRef.current = atRisk.filter((f) => stored.some((s) => sameFile(s, f)));
      }
      fromLinkRef.current = fromLink;
      show(next);
      return landed ? "stored" : "unsaved";
    },
    [show],
  );
  // Restoring APPENDS: the program that replaced the strip may need its own
  // helpers, so bringing the old ones back must not take theirs away. One
  // whose name the strip now uses comes back under a free name.
  const restore = useCallback(() => {
    const next = [...filesRef.current];
    for (const f of [...backupRef.current, ...keptRef.current]) {
      if (next.some((n) => sameFile(n, f))) continue;
      const name = freeName(f.name, next);
      next.push({ name, body: f.body });
      if (f.link) fromLinkRef.current = [...fromLinkRef.current, { name, body: f.body }];
    }
    keptRef.current = [];
    // The backup goes only once the strip holds its files.
    const strip = markLinks(next, fromLinkRef.current);
    if (writeStore(STORE_KEY, strip)) {
      storedRef.current = strip;
      if (writeStore(BACKUP_KEY, [])) backupRef.current = [];
    }
    show(next);
  }, [show]);
  return [files, save, { count: offer.length, restore }];
}
