"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateWatch,
  labelElementSize,
  watchLabelName,
  type ElementSize,
  type EvalContext,
} from "@/lib/emulator/watch-expr";
import type { StackSlot } from "@/lib/emulator/frame-labels";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

const STORE_KEY = "aarch64-playground:watches";

function loadInitial(): string[] {
  const raw = safeGetItem(STORE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed as string[];
    }
  } catch {
    // malformed stored expressions; fall through to the empty list.
  }
  return [];
}

function persist(entries: string[]): void {
  safeSetItem(STORE_KEY, JSON.stringify(entries));
}

export interface WatchPanelProps {
  registers: string[];
  sp: string;
  pc: number;
  frameSlots: StackSlot[];
  getMemory: (addr: number, len: number) => Uint8Array;
  /** Mapped verdict for a range: true/false once known, null while the
   *  async fetch is in flight. Defaults to "always mapped" so a mount
   *  without the surface still reads bytes. */
  getMemoryMapped?: (addr: number, len: number) => boolean | null;
  /** The editor's program text, read for a data label's element size. */
  source?: string;
  /** Data label lookup in the loaded program. Left out, `arr[i]` reads only
   *  frame slots. */
  resolveLabel?: (name: string) => Promise<number | null>;
  /** Changes identity on every assemble or reset, so labels look up again. */
  program?: unknown;
}

interface LabelInfo {
  address: number | null;
  size: ElementSize;
}

export function WatchPanel({
  registers,
  sp,
  frameSlots,
  getMemory,
  getMemoryMapped = () => true,
  source = "",
  resolveLabel,
  program,
}: WatchPanelProps) {
  const [watches, setWatches] = useState<string[]>(loadInitial);
  const [input, setInput] = useState("");
  const [labels, setLabels] = useState<{
    program: unknown;
    names: string;
    info: Map<string, LabelInfo>;
  } | null>(null);
  // The size is read from the text as it stood when the lookup ran, which
  // follows each assemble: an edit made since then must not resize the
  // loaded program's array.
  const sourceRef = useRef(source);

  useEffect(() => {
    persist(watches);
  }, [watches]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const labelNames = useMemo(
    () => [...new Set(watches.map(watchLabelName).filter((n) => n !== null))].join(" "),
    [watches],
  );

  useEffect(() => {
    if (!resolveLabel || labelNames === "") return;
    let live = true;
    const text = sourceRef.current;
    void Promise.all(
      labelNames.split(" ").map(async (name): Promise<[string, LabelInfo]> => {
        const address = await resolveLabel(name).catch(() => null);
        return [name, { address, size: labelElementSize(text, name) }];
      }),
    ).then((entries) => {
      if (live) setLabels({ program, names: labelNames, info: new Map(entries) });
    });
    return () => {
      live = false;
    };
  }, [resolveLabel, labelNames, program]);

  const current =
    labels !== null && labels.program === program && labels.names === labelNames ? labels : null;

  const ctx = useMemo<EvalContext>(
    () => ({
      readRegister: (name) => {
        const lower = name.toLowerCase();
        const num = (hex: string) => BigInt("0x" + hex.replace(/^0x/, ""));
        if (lower === "sp") return num(sp);
        if (lower === "fp") return num(registers[29] ?? "0x0");
        if (lower === "lr") return num(registers[30] ?? "0x0");
        const match = /^([xw])(\d+)$/.exec(lower);
        if (match) {
          const idx = parseInt(match[2], 10);
          const raw = registers[idx];
          if (!raw) return null;
          const full = num(raw);
          return match[1] === "w" ? full & 0xFFFFFFFFn : full;
        }
        return null;
      },
      readMemory: (addr, size) => {
        if (addr < 0n || addr > 0xFFFFFFFFFFFFFFFFn) return "unmapped";
        const addrNum = Number(addr & 0xFFFFFFFFn);
        // The mapped verdict must gate the bytes: get_memory_range
        // deliberately zero-fills unmapped reads for the hex dump, so without
        // it a null dereference renders as 0x0.
        const mapped = getMemoryMapped(addrNum, size);
        if (mapped === null) return "pending";
        if (!mapped) return "unmapped";
        const bytes = getMemory(addrNum, size);
        if (bytes.length === 0) return "pending";
        let v = 0n;
        for (let i = bytes.length - 1; i >= 0; i--) {
          v = (v << 8n) | BigInt(bytes[i]);
        }
        return v;
      },
      resolveSlotOffset: (name) => {
        const slot = frameSlots.find((s) => s.name === name);
        return slot ? BigInt(slot.offset) : null;
      },
      resolveLabelAddress: (name) => {
        if (!resolveLabel) return null;
        if (!current) return "pending";
        const addr = current.info.get(name)?.address;
        return addr != null ? BigInt(addr) : null;
      },
      labelElementSize: (name) =>
        current?.info.get(name)?.size ?? { error: "its label is not in the source" },
    }),
    [registers, sp, frameSlots, getMemory, getMemoryMapped, resolveLabel, current],
  );

  const submit = useCallback(() => {
    const expr = input.trim();
    if (!expr) return;
    if (!watches.includes(expr)) {
      setWatches((w) => [...w, expr]);
    }
    setInput("");
  }, [input, watches]);

  const remove = useCallback((expr: string) => {
    setWatches((w) => w.filter((e) => e !== expr));
  }, []);

  return (
    <div className="p-3 text-xs flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[12px]">
          watches
        </h2>
        <span className="text-[12px] text-[var(--text-secondary)]">
          {watches.length}
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-1 mb-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="x0 or [fp, score1_s] or arr[2]"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="touch-target flex-1 bg-[var(--bg-raised)] border border-[var(--border)] rounded px-2 py-0.5 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          aria-label="watch expression"
        />
        <button
          type="submit"
          className="touch-target px-2 py-0.5 text-[12px] rounded bg-[var(--cyan-dim)] hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        >
          add
        </button>
      </form>
      <div className="flex-1 overflow-auto">
        {watches.length === 0 && (
          <div className="space-y-1">
            <p className="font-serif text-[12px] text-[var(--text-primary)]">
              Watches stay quiet until you ask.
            </p>
            <p className="font-sans text-[12px] text-[var(--text-secondary)]">
              Type an expression like <code className="font-mono">x0</code> or{" "}
              <code className="font-mono">[fp, score1_s]</code> above and press add.
            </p>
          </div>
        )}
        <ul className="space-y-1">
          {watches.map((expr) => {
            const result = evaluateWatch(expr, ctx);
            return (
              <li
                key={expr}
                className="flex items-center justify-between gap-2 font-mono"
              >
                <span className="text-[var(--text-secondary)] truncate">
                  {expr}
                </span>
                <span
                  className={
                    "error" in result
                      ? "text-[var(--danger)] text-[12px]"
                      : "text-[var(--text-primary)]"
                  }
                  title={"error" in result ? result.error : undefined}
                >
                  {"error" in result
                    ? result.error
                    : "pending" in result
                      ? "..."
                      : result.display}
                </span>
                <button
                  type="button"
                  onClick={() => remove(expr)}
                  className="touch-target text-[12px] text-[var(--text-secondary)] hover:text-[var(--danger)] px-1"
                  aria-label={`remove watch ${expr}`}
                >
                  x
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
