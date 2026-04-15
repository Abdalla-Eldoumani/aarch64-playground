"use client";

import { useCallback, useEffect, useState } from "react";

const STORE_KEY = "aarch64-playground:memory-watches";

export interface MemoryWatch {
  label: string;
  addr: number;
  length: number;
}

function load(): MemoryWatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (w) =>
          typeof w === "object" &&
          typeof w.label === "string" &&
          typeof w.addr === "number" &&
          typeof w.length === "number",
      )
    ) {
      return parsed as MemoryWatch[];
    }
  } catch {
    // ignore
  }
  return [];
}

function persist(entries: MemoryWatch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function hexRow(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function asciiRow(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("");
}

export interface MemoryWatchesProps {
  getMemory: (addr: number, len: number) => Uint8Array;
}

/**
 * User-defined memory-range watches. Each entry renders a short hex +
 * ASCII strip; the list persists in localStorage.
 */
export function MemoryWatches({ getMemory }: MemoryWatchesProps) {
  const [watches, setWatches] = useState<MemoryWatch[]>(load);
  const [label, setLabel] = useState("");
  const [addr, setAddr] = useState("0x00400000");
  const [length, setLength] = useState(32);

  useEffect(() => persist(watches), [watches]);

  const add = useCallback(() => {
    const parsed = parseInt(addr, 16);
    if (Number.isNaN(parsed) || length <= 0 || length > 512) return;
    const entry: MemoryWatch = {
      label: label.trim() || `0x${parsed.toString(16)}`,
      addr: parsed,
      length,
    };
    setWatches((w) => [...w, entry]);
    setLabel("");
  }, [label, addr, length]);

  const remove = useCallback((idx: number) => {
    setWatches((w) => w.filter((_, i) => i !== idx));
  }, []);

  return (
    <div className="p-3 text-xs flex flex-col h-full">
      <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[10px] mb-2">
        memory watches
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-wrap gap-1 mb-2"
      >
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="label"
          className="w-20 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          aria-label="watch label"
        />
        <input
          type="text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x00400000"
          className="w-28 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          aria-label="watch address"
        />
        <input
          type="number"
          min={1}
          max={512}
          value={length}
          onChange={(e) => setLength(parseInt(e.target.value, 10) || 1)}
          className="w-14 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] font-mono text-[var(--text-primary)]"
          aria-label="watch length"
        />
        <button
          type="submit"
          className="px-2 py-0.5 text-[11px] rounded bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          add
        </button>
      </form>
      <div className="flex-1 overflow-auto">
        {watches.length === 0 && (
          <div className="text-[10px] text-[var(--text-secondary)]">
            watch a memory range to see it live-updated below.
          </div>
        )}
        <ul className="space-y-2">
          {watches.map((w, i) => {
            const bytes = getMemory(w.addr, w.length);
            return (
              <li key={`${w.label}-${i}`} className="font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--accent)]">{w.label}</span>
                  <span className="text-[var(--text-secondary)] text-[10px]">
                    0x{w.addr.toString(16).padStart(8, "0")} +{w.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--danger)] px-1"
                    aria-label={`remove memory watch ${w.label}`}
                  >
                    x
                  </button>
                </div>
                <div className="text-[var(--text-primary)] break-all">
                  {hexRow(bytes)}
                </div>
                <div className="text-[var(--text-secondary)] text-[10px]">
                  {asciiRow(bytes)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
