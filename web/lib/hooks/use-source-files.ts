"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceFile } from "@/lib/playground/file-map";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:multi-files";
// Helper files the last write displaced. Loading a program REPLACES the
// strip on purpose (a new program must not link another workspace's
// helpers), but until this key existed a plain click on a recent, a
// bookmark, or a files-less share link discarded an afternoon of helper
// files with no way back.
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
    // ignore
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
 * an edit (same name) out of the backup, so the restore affordance appears
 * only when work really went away.
 */
function displacedBy(stored: SourceFile[], next: SourceFile[]): SourceFile[] {
  return stored.filter(
    (f) => !next.some((n) => n.name === f.name || n.body === f.body),
  );
}

/** The strip's discarded-work escape hatch: how many helper files the last
 *  replacement took away, and the one call that brings them back. */
export interface SourceFilesBackup {
  count: number;
  restore: () => void;
}

/**
 * The multi-file workspace's persisted state: the extra source files beside
 * main.asm, the write that replaces them, and the backup of whatever the
 * last write discarded. MultiFileTabs renders this state; it does not own it.
 */
export function useSourceFiles(): [
  SourceFile[],
  (next: SourceFile[]) => void,
  SourceFilesBackup,
] {
  const [files, setFiles] = useState<SourceFile[]>(loadFiles);
  const [backup, setBackup] = useState<SourceFile[]>(loadBackup);
  // The strip as the last writer left it. The backup is decided by comparing
  // the incoming set against this, at the moment of the write -- not in an
  // effect, where the comparison would be a cascading render.
  const filesRef = useRef<SourceFile[]>(files);
  useEffect(() => {
    writeStore(STORE_KEY, files);
  }, [files]);
  const save = useCallback((next: SourceFile[]) => {
    const displaced = displacedBy(filesRef.current, next);
    filesRef.current = next;
    if (displaced.length > 0) {
      writeStore(BACKUP_KEY, displaced);
      setBackup(displaced);
    }
    setFiles(next);
  }, []);
  // Restoring APPENDS: the program that replaced the strip may need its own
  // helpers, so bringing the old ones back must not take theirs away.
  const restore = useCallback(() => {
    const taken = new Set(filesRef.current.map((f) => f.name));
    const next = [
      ...filesRef.current,
      ...backup.filter((f) => !taken.has(f.name)),
    ];
    filesRef.current = next;
    setFiles(next);
    writeStore(BACKUP_KEY, []);
    setBackup([]);
  }, [backup]);
  return [files, save, { count: backup.length, restore }];
}
