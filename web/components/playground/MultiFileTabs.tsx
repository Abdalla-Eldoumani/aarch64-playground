"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { combineSources, type SourceFile } from "@/lib/playground/file-map";

// Re-exported so the tab strip stays the one import site for the
// multi-file workspace pieces; the model itself lives in lib, and the
// persisted state behind the strip lives in lib/hooks/use-source-files.
export { combineSources, type SourceFile };

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
  const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  function promptRename(idx: number, current: string) {
    const next = window.prompt("rename file", current);
    if (next && next.trim()) onRename(idx, next.trim());
  }

  // Arrow keys are bound to the tabs themselves rather than the strip: the
  // strip also holds the new-file input, whose own caret movement must not
  // be hijacked.
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const order = [-1, ...files.map((_, i) => i)];
    const at = order.indexOf(index);
    if (at < 0) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = order[(at + delta + order.length) % order.length];
    onSelect(next);
    tabRefs.current[next]?.focus();
  }

  return (
    // No `aria-controls` on the tabs: the panel a tab selects is the editor,
    // which this strip does not own, and pointing at an element that does not
    // exist is worse than leaving the relationship implicit.
    <div
      role="tablist"
      aria-label="source files"
      className="flex flex-wrap items-center gap-1 px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[11px]"
    >
      <span className="text-[var(--text-secondary)] mr-1">files:</span>
      <button
        type="button"
        role="tab"
        aria-selected={activeIndex === -1}
        tabIndex={activeIndex === -1 ? 0 : -1}
        ref={(node) => {
          tabRefs.current[-1] = node;
        }}
        onClick={() => onSelect(-1)}
        onKeyDown={(e) => onTabKeyDown(e, -1)}
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
            role="tab"
            aria-selected={activeIndex === i}
            tabIndex={activeIndex === i ? 0 : -1}
            ref={(node) => {
              tabRefs.current[i] = node;
            }}
            onClick={() => onSelect(i)}
            onDoubleClick={() => promptRename(i, f.name)}
            // F2 is the rename key; Enter and Space stay activation, or a
            // keyboard student could not select a tab at all.
            onKeyDown={(e) => {
              if (e.key === "F2") {
                e.preventDefault();
                promptRename(i, f.name);
                return;
              }
              onTabKeyDown(e, i);
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
          aria-label="new file name"
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
