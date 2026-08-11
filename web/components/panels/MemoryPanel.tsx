"use client";

import { useCallback, useMemo, useState } from "react";
import { parseAddress } from "@/lib/emulator/parse-address";
import { regionFor, type MemoryRegion } from "@/lib/emulator/memory-map";
import { useZoom } from "@/lib/hooks/use-zoom";
import { ZoomControl } from "@/components/ui/ZoomControl";
import { Select } from "@/components/ui/Select";
import { isAtLeast, useBreakpoint } from "@/lib/hooks/use-breakpoint";

interface MemoryPanelProps {
  getMemory: (addr: number, len: number) => Uint8Array;
  /** `(addr, len)` ranges that the most-recent step wrote. Bytes inside any
   *  range render with a static amber (execution) tint so the student sees what
   *  changed since the previous frame; the range is replaced on the next write,
   *  so only the latest write stays tinted. */
  dirtyAddrs?: Array<[number, number]>;
  /** The emulator's address bands (hub `memoryRegions`). Drives the jump
   *  list and the trigger's region label; empty on a wasm build that
   *  predates the export, which falls back to FALLBACK_JUMP_TARGETS. */
  regions?: MemoryRegion[];
  /** Live stack pointer as the hub reports it ("0x…"), or null. The stack
   *  jump lands on the row holding it rather than a fixed address. */
  sp?: string | null;
}

function isDirty(byteAddr: number, ranges: Array<[number, number]>): boolean {
  for (const [start, len] of ranges) {
    if (byteAddr >= start && byteAddr < start + len) return true;
  }
  return false;
}

const DEFAULT_ROWS = 16;

/** Section bands the jump list offers, in the order it offers them. The
 *  heap, argv and host-stub bands stay out of the list on purpose: they are
 *  worth LABELLING when the window lands there, not worth a row a student
 *  scrolls past on the way to `.data`. */
const JUMP_SECTIONS = [".text", ".rodata", ".data", ".bss"];

/** Where "stack" lands with no live sp to follow: the bottom of the last
 *  page below the stack base, which is what the panel has always offered. */
const STACK_LANDING = 0x7fffff00;

/** The list before the exported map exists (an older local wasm build).
 *  Same labels and addresses the panel shipped with. */
const FALLBACK_JUMP_TARGETS: Array<{ label: string; addr: string }> = [
  { label: ".text", addr: "0x00400000" },
  { label: ".rodata", addr: "0x00500000" },
  { label: ".data", addr: "0x00600000" },
  { label: ".bss", addr: "0x00700000" },
  { label: "stack", addr: "0x7fffff00" },
];

/**
 * The jump list, derived from the emulator's own map so the offers cannot
 * drift from the loader. "stack" follows the live sp (aligned down to the
 * 16-byte row) whenever sp is inside the stack band -- which is also the
 * "a program is loaded" test, since a reset machine parks sp at the band's
 * exclusive end and a broken prologue leaves it at zero.
 */
function jumpTargets(
  regions: MemoryRegion[],
  sp: number | null,
): Array<{ label: string; addr: string }> {
  if (regions.length === 0) return FALLBACK_JUMP_TARGETS;
  const targets: Array<{ label: string; addr: string }> = [];
  for (const name of JUMP_SECTIONS) {
    const region = regions.find((r) => r.name === name);
    if (region) targets.push({ label: name, addr: formatAddr(region.start) });
  }
  const stack = regions.find((r) => r.name === "stack");
  if (stack) {
    const live = sp != null && sp >= stack.start && sp < stack.end;
    // Modulo, not a bitwise mask: the stack band sits at the top of the
    // 32-bit space and `& ~0xf` would sign-flip an address past 0x7fffffff.
    targets.push({ label: "stack", addr: formatAddr(live ? sp - (sp % 16) : STACK_LANDING) });
  }
  return targets;
}

export function MemoryPanel({
  getMemory,
  dirtyAddrs = [],
  regions = [],
  sp = null,
}: MemoryPanelProps) {
  const [baseAddr, setBaseAddr] = useState("0x00400000");
  // The last address that parsed. A mistyped character keeps the window
  // here instead of silently truncating to a low address whose zeros read
  // as "my .data is empty".
  const [lastGoodAddr, setLastGoodAddr] = useState(0x00400000);
  const [rows] = useState(DEFAULT_ROWS);
  const zoom = useZoom("memory");
  // 16 bytes/row reads naturally on a desktop monospace grid; below sm
  // the row overflows the viewport, so collapse to 8/row -- still
  // 16-byte aligned so addresses stay in even multiples.
  const bp = useBreakpoint();
  const bytesPerRow = isAtLeast(bp, "sm") ? 16 : 8;

  const parsed = parseAddress(baseAddr);
  const addr = parsed ?? lastGoodAddr;
  const totalBytes = rows * bytesPerRow;
  const data = getMemory(addr, totalBytes);

  const spValue = sp == null ? null : parseAddress(sp);
  const targets = useMemo(() => jumpTargets(regions, spValue), [regions, spValue]);
  // What the trigger reads: the band the window is actually in, updated live
  // as the student types. A bad address holds the last good window, so the
  // label keeps naming that window's region -- it describes what is on
  // screen, and the alert below already reports the rejection. Without the
  // map there is nothing to name, so the trigger keeps its "jump..." text.
  const region = regions.length > 0 ? regionFor(addr, regions) : null;
  const triggerLabel =
    regions.length === 0 ? undefined : region ? `in ${region.name}` : "unmapped";

  const handleAddrChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBaseAddr(e.target.value);
      const p = parseAddress(e.target.value);
      if (p != null) setLastGoodAddr(p);
    },
    []
  );

  return (
    <div
      className="p-3"
      style={{ ...zoom.style, fontSize: `calc(0.75rem * var(--font-scale, 1))` }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        if (e.deltaY < 0) zoom.zoomIn();
        else zoom.zoomOut();
      }}
    >
      <div className="flex items-center flex-wrap gap-2 mb-2">
        <label htmlFor="memory-base-addr" className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
          address
        </label>
        <input
          id="memory-base-addr"
          type="text"
          value={baseAddr}
          onChange={handleAddrChange}
          aria-label="memory base address"
          className="bg-[var(--bg-raised)] border border-[var(--border)] rounded px-2 py-0.5 text-xs font-mono w-32 text-[var(--text-primary)]"
        />
        <Select
          size="xs"
          placeholder="jump..."
          triggerLabel={triggerLabel}
          ariaLabel="jump to section"
          groups={[
            { options: targets.map((j) => ({ value: j.addr, label: j.label })) },
          ]}
          onSelect={(addrValue) => {
            setBaseAddr(addrValue);
            const p = parseAddress(addrValue);
            if (p != null) setLastGoodAddr(p);
          }}
        />
        <ZoomControl
          scale={zoom.scale}
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onReset={zoom.reset}
          className="ml-auto"
        />
      </div>
      {parsed == null && (
        <div role="alert" className="text-[var(--error)] text-[10px] mb-2">
          address must be hex (0x...) or decimal -- showing 0x
          {lastGoodAddr.toString(16).padStart(8, "0")}
        </div>
      )}

      <table className="w-full font-mono">
        <thead>
          <tr className="text-[var(--text-secondary)]">
            <th className="text-left pr-2 sm:pr-4">addr</th>
            {Array.from({ length: bytesPerRow }, (_, i) => (
              <th key={i} className="w-5 sm:w-6 text-center">
                {i.toString(16).toUpperCase()}
              </th>
            ))}
            <th className="pl-2 sm:pl-4 text-left">ascii</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => {
            const rowAddr = addr + row * bytesPerRow;
            const rowBytes = data.slice(
              row * bytesPerRow,
              (row + 1) * bytesPerRow
            );
            return (
              <tr key={row} className="hover:bg-[var(--bg-elevated)]">
                <td className="text-[var(--text-secondary)] pr-2 sm:pr-4">
                  {formatAddr(rowAddr)}
                </td>
                {Array.from(rowBytes).map((byte, i) => {
                  const dirty = isDirty(rowAddr + i, dirtyAddrs);
                  return (
                    <td
                      key={i}
                      className={`text-center ${
                        dirty
                          ? "bg-[var(--amber-dim)] text-[var(--text-primary)] rounded-sm"
                          : byte !== 0
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {byte.toString(16).padStart(2, "0")}
                    </td>
                  );
                })}
                {/* pad if data is short */}
                {Array.from(
                  { length: bytesPerRow - rowBytes.length },
                  (_, i) => (
                    <td key={`pad-${i}`} className="text-center text-[var(--text-secondary)]">
                      ..
                    </td>
                  )
                )}
                <td className="pl-2 sm:pl-4 text-[var(--text-secondary)]">
                  {asciiString(rowBytes)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatAddr(addr: number): string {
  return "0x" + addr.toString(16).padStart(8, "0");
}

function asciiString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("");
}
