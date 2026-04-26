"use client";

import { useMemo, useSyncExternalStore } from "react";
import { lookupDoc } from "@/lib/instruction-docs";

export interface ExplainStripProps {
  /** Full source text -- needed to extract the line that just executed. */
  source: string;
  /** 1-based line of the most recently executed (or about-to-execute) instruction, or null. */
  currentLine: number | null;
}

function extractAliases(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^\s*define\(\s*([A-Za-z_][\w]*)\s*,\s*([^)]+?)\s*\)\s*$/gm;
  for (const m of source.matchAll(re)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const STORAGE_KEY = "aarch64-playground:explain-strip";

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      // Vertical space is at a premium on phones; default the strip
      // off below the `sm` breakpoint so it doesn't crowd the editor.
      // Desktop and tablet keep the default-on behavior.
      return window.innerWidth >= 640;
    }
    return raw !== "off";
  } catch {
    return true;
  }
}

function writeEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    window.dispatchEvent(new CustomEvent("aarch64-playground:explain-strip-changed"));
  } catch {
    // ignore quota / private mode failures
  }
}

function subscribeEnabled(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener("aarch64-playground:explain-strip-changed", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("aarch64-playground:explain-strip-changed", onCustom);
  };
}

function describeLine(
  rawLine: string,
  aliases?: Record<string, string>,
): string | null {
  if (!rawLine) return null;
  let line = rawLine.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
  if (!line) return null;
  // Strip a leading `label:` if present.
  const labelMatch = line.match(/^[A-Za-z_.$][\w.$]*\s*:\s*(.*)$/);
  if (labelMatch) line = labelMatch[1];
  if (!line) return null;
  const space = line.search(/\s/);
  const mnemonic = (space === -1 ? line : line.slice(0, space)).toUpperCase();
  const operands = space === -1 ? "" : line.slice(space).trim();

  const doc = lookupDoc(mnemonic);
  if (!doc) {
    // Directives, labels, and pseudo-ops fall through.
    if (mnemonic.startsWith(".")) return `directive ${mnemonic.toLowerCase()} -- emits data or controls section layout`;
    return null;
  }
  if (doc.notImplemented) {
    return `${mnemonic.toLowerCase()} -- not implemented in this emulator`;
  }
  // Surface alias resolutions so a student sees `score1_r -> w19`.
  const resolved = aliases ? resolveAliases(operands, aliases) : null;
  const detail = resolved && resolved !== operands ? ` (aliases: ${resolved})` : "";
  return `${mnemonic.toLowerCase()} ${operands}${detail} -- ${doc.summary}`;
}

function resolveAliases(operands: string, aliases: Record<string, string>): string {
  if (!operands) return operands;
  return operands.replace(/\b([A-Za-z_][\w]*)\b/g, (match) => {
    const target = aliases[match];
    if (!target || target === match) return match;
    return `${match}=${target}`;
  });
}

/**
 * One-line plain-English explanation of the instruction the CPU is
 * about to execute (or just executed). Sits under the Controls bar so
 * the student can read what each step is doing without leaving the
 * editor. Toggle persists in localStorage; on by default.
 */
export function ExplainStrip({ source, currentLine }: ExplainStripProps) {
  // useSyncExternalStore reads the same localStorage flag the toggle
  // writes to. Server snapshot stays `true` (the default-on state) so
  // hydration matches; the client snapshot can flip on the first
  // commit if the user previously hid the strip.
  const enabled = useSyncExternalStore(subscribeEnabled, readEnabled, () => true);

  const aliases = useMemo(() => extractAliases(source), [source]);

  const explanation = useMemo(() => {
    if (!enabled || currentLine == null) return null;
    const lines = source.split("\n");
    const raw = lines[currentLine - 1] ?? "";
    return describeLine(raw, aliases);
  }, [enabled, source, currentLine, aliases]);

  if (!enabled) {
    return (
      <div className="px-3 py-1 text-[11px] text-[var(--text-secondary)] flex items-center justify-end border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          type="button"
          onClick={() => {
            writeEnabled(true);
          }}
          className="hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded px-1"
          aria-label="show explain strip"
        >
          show explain
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-1 text-[11px] flex items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)]"
      aria-label="explain strip"
    >
      <span className="text-[var(--text-secondary)] font-mono">explain:</span>
      <span className="text-[var(--text-primary)] truncate flex-1" title={explanation ?? undefined}>
        {explanation ?? "step the program to see a description here"}
      </span>
      <button
        type="button"
        onClick={() => {
          writeEnabled(false);
        }}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded px-1 shrink-0"
        aria-label="hide explain strip"
      >
        hide
      </button>
    </div>
  );
}
