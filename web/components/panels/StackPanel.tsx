"use client";

import { useZoom } from "@/lib/hooks/use-zoom";
import { ZoomControl } from "@/components/ui/ZoomControl";
import { labelForOffset, type StackSlot } from "@/lib/emulator/frame-labels";
import { formatWord32, formatWord64 } from "@/lib/emulator/format-hex";

interface StackPanelProps {
  sp: string;
  getMemory: (addr: number, len: number) => Uint8Array;
  fp?: number;
  frameSlots?: StackSlot[];
}

// The band's exclusive end, where a reset machine parks sp.
const STACK_BASE = 0x80000000;
const ROWS_TO_SHOW = 16;

export function StackPanel({ sp, getMemory, fp, frameSlots = [] }: StackPanelProps) {
  // A genuinely-zero SP (broken prologue, x29 never set) is real state, not
  // a parse failure: `|| STACK_BASE` would hide the one anomaly this panel
  // exists to show.
  const parsedSp = parseInt(sp, 16);
  const spVal = Number.isNaN(parsedSp) ? STACK_BASE : parsedSp;
  const bytesToShow = ROWS_TO_SHOW * 8;
  const data = getMemory(spVal, bytesToShow);
  const zoom = useZoom("stack");

  const fpVal = fp ?? 0;
  const fpInView = fpVal >= spVal && fpVal < spVal + bytesToShow;

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
        <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
          stack
        </span>
        <span className="font-mono text-[var(--amber)]">
          SP = {formatWord64(spVal)}
        </span>
        {fpVal > 0 && (
          <span className="font-mono text-[var(--text-secondary)]">
            FP = {formatWord64(fpVal)}
          </span>
        )}
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
            <th className="text-left">address</th>
            <th className="text-left pl-4">value (u64)</th>
            <th className="hidden sm:table-cell text-left pl-4">label</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROWS_TO_SHOW }, (_, row) => {
            const addr = spVal + row * 8;
            const slice = data.slice(row * 8, (row + 1) * 8);

            // little-endian u64
            let val = BigInt(0);
            for (let i = 7; i >= 0; i--) {
              val = (val << BigInt(8)) | BigInt(slice[i] ?? 0);
            }
            const hex = formatWord64(val);
            const isZero = val === BigInt(0);

            const fpOffset = fpInView && fpVal > 0 ? addr - fpVal : null;
            const label =
              fpOffset !== null && fpOffset >= 0
                ? labelForOffset(frameSlots, fpOffset)
                : null;
            const isFpRow = fpInView && addr === fpVal;
            const rowClass = row === 0
              ? "text-[var(--amber)]"
              : isFpRow
                ? "text-[var(--success)]"
                : "";

            return (
              <tr
                key={row}
                className={`hover:bg-[var(--bg-elevated)] ${rowClass}`}
              >
                {/* The address column stays 32-bit wide while SP/FP above it
                    read 64: it is the narrow first column of a three-column
                    table that has to survive 375px, and every stack address
                    this emulator hands out fits 32 bits. */}
                <td className="text-[var(--text-secondary)]">
                  {formatWord32(addr)}
                </td>
                <td
                  className={`pl-4 ${
                    isZero
                      ? "text-[var(--text-secondary)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {hex}
                </td>
                <td className="hidden sm:table-cell pl-4 text-[var(--text-secondary)]">
                  {label ? (
                    <span>
                      [fp, <span className="text-[var(--text-primary)]">{label}</span>]
                    </span>
                  ) : isFpRow ? (
                    <span className="text-[var(--success)]">fp</span>
                  ) : fpOffset !== null && fpOffset > 0 ? (
                    <span>[fp, {fpOffset}]</span>
                  ) : (
                    <span>SP+{row * 8}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
