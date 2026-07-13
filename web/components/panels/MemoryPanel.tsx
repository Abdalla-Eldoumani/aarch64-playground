"use client";

import { useCallback, useState } from "react";
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
}

function isDirty(byteAddr: number, ranges: Array<[number, number]>): boolean {
  for (const [start, len] of ranges) {
    if (byteAddr >= start && byteAddr < start + len) return true;
  }
  return false;
}

const DEFAULT_ROWS = 16;

const JUMP_TARGETS: Array<{ label: string; addr: string }> = [
  { label: ".text", addr: "0x00400000" },
  { label: ".rodata", addr: "0x00500000" },
  { label: ".data", addr: "0x00600000" },
  { label: ".bss", addr: "0x00700000" },
  { label: "stack", addr: "0x7fffff00" },
];

export function MemoryPanel({ getMemory, dirtyAddrs = [] }: MemoryPanelProps) {
  const [baseAddr, setBaseAddr] = useState("0x00400000");
  const [rows] = useState(DEFAULT_ROWS);
  const zoom = useZoom("memory");
  // 16 bytes/row reads naturally on a desktop monospace grid; below sm
  // the row overflows the viewport, so collapse to 8/row -- still
  // 16-byte aligned so addresses stay in even multiples.
  const bp = useBreakpoint();
  const bytesPerRow = isAtLeast(bp, "sm") ? 16 : 8;

  const addr = parseInt(baseAddr, 16) || 0;
  const totalBytes = rows * bytesPerRow;
  const data = getMemory(addr, totalBytes);

  const handleAddrChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBaseAddr(e.target.value);
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
          ariaLabel="jump to section"
          groups={[
            { options: JUMP_TARGETS.map((j) => ({ value: j.addr, label: j.label })) },
          ]}
          onSelect={(addrValue) => setBaseAddr(addrValue)}
        />
        <ZoomControl
          scale={zoom.scale}
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onReset={zoom.reset}
          className="ml-auto"
        />
      </div>

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
