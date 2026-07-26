"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { combineSources, type SourceFile } from "@/lib/playground/file-map";

// Re-exported so the tab strip stays the one import site for the
// multi-file workspace pieces; the model itself lives in lib.
export { combineSources, type SourceFile };

const STORE_KEY = "aarch64-playground:multi-files";
// Helper files the last write displaced. Loading a program REPLACES the
// strip on purpose (a new program must not link another workspace's
// helpers), but until this key existed a plain click on a recent, a
// bookmark, or a files-less share link discarded an afternoon of helper
// files with no way back.
const BACKUP_KEY = "aarch64-playground:multi-files-backup";

function readStore(key: string): SourceFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
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
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(files));
  } catch {
    // ignore
  }
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

export interface MultiFileTabsProps {
  /** Current active file index in the auxiliary list (main.asm is implicit). */
  files: SourceFile[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onAdd: (name: string) => void;
  onRemove: (idx: number) => void;
  onRename: (idx: number, name: string) => void;
  /** Helper files the last strip replacement discarded; 0 hides the offer. */
  backupCount?: number;
  onRestoreBackup?: () => void;
}

/**
 * Tab strip for multi-file assembly. The main editor holds `main.asm`;
 * this strip manages any number of extra source files the linker will
 * concatenate with main before assembling. Useful for the week 11/12
 * tutorials that split `bl` callers and callees across files.
 */
export function MultiFileTabs({
  files,
  activeIndex,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  backupCount = 0,
  onRestoreBackup,
}: MultiFileTabsProps) {
  const [pending, setPending] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[11px]">
      <span className="text-[var(--text-secondary)] mr-1">files:</span>
      <button
        type="button"
        onClick={() => onSelect(-1)}
        className={`px-2 py-0.5 rounded ${
          activeIndex === -1
            ? "bg-[var(--cyan)] text-[var(--on-cyan)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        main.asm
      </button>
      {files.map((f, i) => (
        <span
          key={`${f.name}-${i}`}
          className={`inline-flex items-center rounded ${
            activeIndex === i ? "bg-[var(--cyan)] text-[var(--on-cyan)]" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect(i)}
            onDoubleClick={() => {
              const next = window.prompt("rename file", f.name);
              if (next && next.trim()) onRename(i, next.trim());
            }}
            className="px-2 py-0.5"
          >
            {f.name}
          </button>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`remove ${f.name}`}
            className="inline-flex items-center justify-center min-w-[24px] min-h-[24px] px-1 text-[var(--text-secondary)] hover:text-[var(--danger)]"
          >
            x
          </button>
        </span>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pending.trim()) {
            onAdd(pending.trim());
            setPending("");
          }
        }}
        className="inline-flex items-center gap-1 ml-1"
      >
        <input
          type="text"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          placeholder="new.asm"
          className="w-20 bg-[var(--bg-raised)] border border-[var(--border)] rounded px-1 py-0.5 text-[11px] text-[var(--text-primary)]"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center min-w-[24px] min-h-[24px] px-1 text-[var(--text-secondary)] hover:text-[var(--cyan)]"
          aria-label="add file"
        >
          +
        </button>
      </form>
      {backupCount > 0 && onRestoreBackup && (
        <button
          type="button"
          onClick={onRestoreBackup}
          className="ml-1 rounded px-2 py-0.5 text-[var(--cyan)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        >
          restore {backupCount} replaced file{backupCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

/** The strip's discarded-work escape hatch: how many helper files the last
 *  replacement took away, and the one call that brings them back. */
export interface SourceFilesBackup {
  count: number;
  restore: () => void;
}

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
