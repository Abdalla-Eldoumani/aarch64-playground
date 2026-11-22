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

const size = (files: Stored[]) => JSON.stringify(files).length;

/**
 * `list` without its oldest copies of link files, as many as free `need`
 * characters, or null when they cannot. Storage held the larger value, so a
 * write that grows by `need` fits once these go.
 */
function dropOldestLinks(list: Stored[], need: number): Stored[] | null {
  let freed = 0;
  const left = list.filter((f) => {
    if (freed >= need || !f.link) return true;
    freed += size([f]);
    return false;
  });
  return freed >= need ? left : null;
}

/**
 * Store `wanted` as the backup in place of `stored`, giving up the oldest
 * copies of link files if it does not fit; `freed` is room the strip just
 * gave up. Returns what was stored, or null with the stored backup unchanged.
 */
function storeBackup(wanted: Stored[], stored: Stored[], freed = 0): Stored[] | null {
  if (writeStore(BACKUP_KEY, wanted)) return wanted;
  const left = dropOldestLinks(wanted, size(wanted) - size(stored) - freed);
  return left && writeStore(BACKUP_KEY, left) ? left : null;
}

/**
 * Store `strip` in place of `stored`, giving up the oldest copies of link
 * files in `backup` (what the backup key holds) if it does not fit. Returns
 * the backup now stored, or null with both keys as they were.
 */
function storeStrip(strip: Stored[], stored: Stored[], backup: Stored[]): Stored[] | null {
  if (writeStore(STORE_KEY, strip)) return backup;
  const left = dropOldestLinks(backup, size(strip) - size(stored));
  if (!left || !writeStore(BACKUP_KEY, left)) return null;
  if (writeStore(STORE_KEY, strip)) return left;
  writeStore(BACKUP_KEY, backup);
  return null;
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
        const left = storeStrip(strip, storedRef.current, backupRef.current);
        if (!left) return "unsaved";
        storedRef.current = strip;
        if (left !== backupRef.current) {
          backupRef.current = left;
          setOffer(left);
        }
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
      const own = [...screen, ...keptRef.current, ...backupRef.current].filter((f) => !f.link);
      const fromLink = next.filter((n) => !own.some((o) => sameFile(o, n)));
      const strip = markLinks(next, fromLink);
      const stored = storedRef.current;
      const before = safeGetItem(BACKUP_KEY);
      // A copy of a link file the load puts back unchanged is not needed.
      const copies = backupRef.current.filter((k) => !(k.link && next.some((n) => sameFile(n, k))));
      const wanted = [...copies, ...atRisk];

      // The copies go first, while the old strip still holds the originals.
      let backup =
        atRisk.length > 0 || copies.length !== backupRef.current.length
          ? storeBackup(wanted, backupRef.current)
          : backupRef.current;
      let landed = false;
      let putBackFailed = false;
      if (!backup && size(strip) < size(stored)) {
        // A smaller strip makes room for the copies; if they still do not
        // fit, the old strip goes back.
        if (writeStore(STORE_KEY, strip)) {
          backup = storeBackup(wanted, backupRef.current, size(stored) - size(strip));
          landed = backup !== null;
          if (!backup && !writeStore(STORE_KEY, stored)) {
            storedRef.current = strip;
            putBackFailed = true;
          }
        }
      }
      if (backup && !landed) {
        const left = storeStrip(strip, stored, backup);
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
    // The backup goes only once the strip holds its files. A strip that does
    // not fit beside the backup takes the backup's room, and the backup goes
    // back if even that is not enough.
    const strip = markLinks(next, fromLinkRef.current);
    const backup = backupRef.current;
    let landed = writeStore(STORE_KEY, strip);
    if (!landed && backup.length > 0 && writeStore(BACKUP_KEY, [])) {
      landed = writeStore(STORE_KEY, strip);
      if (!landed && !writeStore(BACKUP_KEY, backup)) backupRef.current = [];
    }
    if (landed) {
      storedRef.current = strip;
      if (writeStore(BACKUP_KEY, [])) backupRef.current = [];
    }
    show(next);
  }, [show]);
  return [files, save, { count: offer.length, restore }];
}
