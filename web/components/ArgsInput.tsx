"use client";

import { useEffect } from "react";
import { hashString } from "@/lib/auto-save";

export interface ArgsInputProps {
  /** The current source -- used to key the per-program persistence. */
  source: string;
  /** Raw text from the input. Parent calls `parseArgs` before passing to assemble. */
  value: string;
  onChange: (next: string) => void;
}

const STORE_KEY_PREFIX = "aarch64-playground:args:";

function loadFor(source: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORE_KEY_PREFIX + hashString(source)) ?? "";
  } catch {
    return "";
  }
}

function saveFor(source: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(STORE_KEY_PREFIX + hashString(source), value);
    } else {
      window.localStorage.removeItem(STORE_KEY_PREFIX + hashString(source));
    }
  } catch {
    // localStorage can be disabled / quota-exceeded; skip silently.
  }
}

/**
 * Compact text input rendered in the header for command-line arguments.
 * The value gets parsed shell-style (`hello "two words"` -> two args)
 * and threaded into the next assemble call so `main(int argc, char **argv)`
 * sees them. Last-used args persist per-program in localStorage so a
 * student returning to week11_argv keeps their `hello world` typed in.
 */
export function ArgsInput({ source, value, onChange }: ArgsInputProps) {
  // Restore whatever args were last typed for this program.
  useEffect(() => {
    const saved = loadFor(source);
    if (saved && saved !== value) {
      onChange(saved);
    }
    // Run only when the program changes; we don't want to clobber the
    // user's in-progress typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Persist as the user types, but with a tiny debounce so we aren't
  // hitting localStorage on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => saveFor(source, value), 250);
    return () => clearTimeout(id);
  }, [source, value]);

  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
      <span className="hidden sm:inline">args</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="argv..."
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="command-line arguments"
        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-2 sm:py-0.5 min-h-[36px] sm:min-h-0 font-mono text-[11px] text-[var(--text-primary)] w-24 sm:w-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
    </label>
  );
}
