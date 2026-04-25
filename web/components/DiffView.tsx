"use client";

import { useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface DiffViewProps {
  open: boolean;
  baseline: string;
  baselineLabel: string;
  current: string;
  onClose: () => void;
}

/**
 * Full-screen diff modal wrapping Monaco's built-in `DiffEditor`. Left
 * pane is the baseline (the last example/share/recent source loaded
 * into the playground); right pane is the current editor buffer. Read-
 * only on the left, editable on the right so a student can tweak and
 * immediately see what changed.
 */
export function DiffView({
  open,
  baseline,
  baselineLabel,
  current,
  onClose,
}: DiffViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]"
      role="dialog"
      aria-modal="true"
      aria-label="diff against loaded example"
    >
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          diff
        </span>
        <span className="text-[11px] text-[var(--text-secondary)] truncate">
          baseline: {baselineLabel || "(default snippet)"}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          close
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <DiffEditor
          height="100%"
          language="arm64"
          original={baseline}
          modified={current}
          theme="vs-dark"
          options={{
            readOnly: true,
            originalEditable: false,
            minimap: { enabled: false },
            renderSideBySide: true,
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}
