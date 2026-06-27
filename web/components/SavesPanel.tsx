"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useNamedSaves } from "@/lib/use-named-saves";
import { MAX_BOOKMARK_JSON_BYTES, checkUploadSize } from "@/lib/upload-guard";

export interface SavesPanelProps {
  /** Session save-state names from the live hub. */
  savedStates: string[];
  onSaveState: (name: string) => void;
  onLoadState: (name: string) => void;
  onDeleteState: (name: string) => void;
  /** Current editor buffer + args, captured into a persistent bookmark. */
  source: string;
  args: string;
  stepCount: number;
  onLoadSource: (source: string, label?: string) => void;
  onSetArgs: (args: string) => void;
  onRestoreBookmark: (params: {
    source: string;
    args?: string;
    stdin?: string;
    stepCount: number;
  }) => Promise<void>;
}

/**
 * Two persistence surfaces stacked in one panel: ephemeral session
 * save-states (in the live hub) and persistent bookmarks (localStorage via
 * useNamedSaves, with JSON export/import). Restoring a bookmark drives the
 * hub through assemble + stdin + step-to-count so the CPU lands where the
 * bookmark was taken.
 */
export function SavesPanel({
  savedStates,
  onSaveState,
  onLoadState,
  onDeleteState,
  source,
  args,
  stepCount,
  onLoadSource,
  onSetArgs,
  onRestoreBookmark,
}: SavesPanelProps) {
  const namedSaves = useNamedSaves();
  const toast = useToast();
  const [saveName, setSaveName] = useState("");
  const [bookmarkName, setBookmarkName] = useState("");
  const bookmarkImportRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-3 text-xs flex flex-col h-full overflow-auto">
      <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px] mb-2">
        save states (this session)
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (saveName.trim()) {
            onSaveState(saveName.trim());
            setSaveName("");
          }
        }}
        className="flex gap-1 mb-2"
      >
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="checkpoint name"
          className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] text-[var(--text-primary)]"
          aria-label="save state name"
        />
        <button
          type="submit"
          className="px-2 py-0.5 text-[11px] rounded bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black text-[var(--text-primary)]"
        >
          save
        </button>
      </form>
      <ul className="space-y-1 mb-4">
        {savedStates.length === 0 && (
          <li className="text-[10px] text-[var(--text-secondary)]">
            no saved states yet.
          </li>
        )}
        {savedStates.map((name) => (
          <li
            key={name}
            className="flex items-center justify-between gap-2 font-mono"
          >
            <span className="text-[var(--text-primary)] truncate">{name}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onLoadState(name)}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                load
              </button>
              <button
                type="button"
                onClick={() => onDeleteState(name)}
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--danger)]"
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
          bookmarks (persistent)
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const bundle = namedSaves.exportBundle();
              try {
                await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
                toast.show(`exported ${bundle.saves.length} bookmark${bundle.saves.length === 1 ? "" : "s"} to clipboard`);
              } catch {
                toast.error("clipboard write failed");
              }
            }}
            className="text-[10px] text-[var(--accent)] hover:underline"
          >
            export json
          </button>
          <button
            type="button"
            onClick={() => bookmarkImportRef.current?.click()}
            className="text-[10px] text-[var(--accent)] hover:underline"
          >
            import json
          </button>
        </div>
      </div>
      <input
        ref={bookmarkImportRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const sizeError = checkUploadSize(file.size, MAX_BOOKMARK_JSON_BYTES, "bookmark file");
          if (sizeError) {
            toast.error(sizeError);
            e.target.value = "";
            return;
          }
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const result = namedSaves.importBundle(parsed);
            toast.show(`imported ${result.added} added, ${result.skipped} skipped`);
          } catch {
            toast.error("invalid bookmark bundle");
          } finally {
            e.target.value = "";
          }
        }}
        aria-label="import bookmark bundle"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = bookmarkName.trim();
          if (!name) return;
          namedSaves.put({
            name,
            source,
            args: args || undefined,
            stepCount,
            savedAt: new Date().toISOString(),
          });
          setBookmarkName("");
        }}
        className="flex gap-1 mb-2"
      >
        <input
          type="text"
          value={bookmarkName}
          onChange={(e) => setBookmarkName(e.target.value)}
          placeholder="bookmark name"
          className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] text-[var(--text-primary)]"
          aria-label="bookmark name"
        />
        <button
          type="submit"
          className="px-2 py-0.5 text-[11px] rounded bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black text-[var(--text-primary)]"
        >
          bookmark
        </button>
      </form>
      <ul className="space-y-1">
        {namedSaves.saves.length === 0 && (
          <li className="text-[10px] text-[var(--text-secondary)]">
            no bookmarks yet.
          </li>
        )}
        {namedSaves.saves.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between gap-2 font-mono"
          >
            <span className="text-[var(--text-primary)] truncate" title={`step ${s.stepCount} -- ${s.savedAt}`}>
              {s.name}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  onLoadSource(s.source, s.name);
                  if (s.args !== undefined) onSetArgs(s.args);
                  // Drive the backend through assemble + stdin push +
                  // step-to-count so the live CPU lands at the same
                  // execution point the bookmark captured. Toast
                  // surfaces the result so the student sees what
                  // happened.
                  try {
                    await onRestoreBookmark({
                      source: s.source,
                      args: s.args,
                      stdin: s.stdin,
                      stepCount: s.stepCount,
                    });
                    toast.show(`restored ${s.name} (step ${s.stepCount})`);
                  } catch {
                    toast.error(`restore failed for ${s.name}`);
                  }
                }}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                load
              </button>
              <button
                type="button"
                onClick={() => namedSaves.remove(s.name)}
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--danger)]"
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
