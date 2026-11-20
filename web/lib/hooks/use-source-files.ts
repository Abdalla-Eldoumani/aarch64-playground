"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_FILE_NAME_CHARS, type SourceFile } from "@/lib/playground/file-map";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:multi-files";
// Helper files writes displaced. Loading a program REPLACES the strip on
// purpose (a new program must not link another workspace's helpers), so the
// displaced files are kept here, every load's until a restore, and can be
// restored.
const BACKUP_KEY = "aarch64-playground:multi-files-backup";

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

function loadFiles(): SourceFile[] {
  return readStore(STORE_KEY);
}

function loadBackup(): SourceFile[] {
  return readStore(BACKUP_KEY);
}

function writeStore(key: string, files: SourceFile[]): void {
  safeSetItem(key, JSON.stringify(files));
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

/**
 * A file a program load is about to lose: its body does not come back. A
 * name the program reuses is no match, since the program's file is not the
 * student's.
 */
function replacedBy(stored: SourceFile[], next: SourceFile[]): SourceFile[] {
  return stored.filter((f) => !next.some((n) => n.body === f.body));
}

function sameFile(a: SourceFile, b: SourceFile): boolean {
  return a.name === b.name && a.body === b.body;
}

/** `name`, or a free name for it when the strip uses it: stack.s comes back as 2-stack.s. */
function freeName(name: string, files: SourceFile[]): string {
  const taken = new Set(files.map((f) => f.name));
  let candidate = name;
  for (let i = 2; taken.has(candidate); i++) {
    // A digit-led prefix keeps a valid name valid; the slice keeps it within the cap.
    candidate = `${i}-${name}`.slice(0, MAX_FILE_NAME_CHARS);
  }
  return candidate;
}

/** How many helper files the last replacement displaced, and the call that
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
  (next: SourceFile[], how?: { load: boolean }) => void,
  SourceFilesBackup,
] {
  const [files, setFiles] = useState<SourceFile[]>(loadFiles);
  const [backup, setBackup] = useState<SourceFile[]>(loadBackup);
  // The strip as the last writer left it. The backup is decided by comparing
  // the incoming set against this, at the moment of the write, not in an
  // effect, where the comparison would be a cascading render.
  const filesRef = useRef<SourceFile[]>(files);
  // The backup as the last write left it, read at the write for the same reason.
  const backupRef = useRef<SourceFile[]>(backup);
  useEffect(() => {
    writeStore(STORE_KEY, files);
  }, [files]);
  const keepBackup = useCallback((next: SourceFile[]) => {
    backupRef.current = next;
    writeStore(BACKUP_KEY, next);
    setBackup(next);
  }, []);
  const save = useCallback(
    (next: SourceFile[], how?: { load: boolean }) => {
      const kept = backupRef.current;
      // A load adds to the backup, so a second load cannot push out what the
      // first displaced; any other write displaces into it alone.
      const displaced = how?.load
        ? replacedBy(filesRef.current, next).filter((f) => !kept.some((k) => sameFile(k, f)))
        : displacedBy(filesRef.current, next);
      filesRef.current = next;
      if (displaced.length > 0) keepBackup(how?.load ? [...kept, ...displaced] : displaced);
      setFiles(next);
    },
    [keepBackup],
  );
  // Restoring APPENDS: the program that replaced the strip may need its own
  // helpers, so bringing the old ones back must not take theirs away. One
  // whose name the strip now uses comes back under a free name.
  const restore = useCallback(() => {
    const next = [...filesRef.current];
    for (const f of backupRef.current) {
      if (!next.some((n) => sameFile(n, f))) next.push({ name: freeName(f.name, next), body: f.body });
    }
    filesRef.current = next;
    setFiles(next);
    keepBackup([]);
  }, [keepBackup]);
  return [files, save, { count: backup.length, restore }];
}
