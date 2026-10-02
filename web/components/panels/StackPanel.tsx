"use client";

import { useEffect, useReducer } from "react";
import { useZoom } from "@/lib/hooks/use-zoom";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";
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
/** The window is 128 bytes at sp: 16 slots of 8 bytes, or 32 of 4. */
const BYTES_TO_SHOW = 128;
const WIDTH_KEY = "aarch64-playground:stack-width";

/** Bytes per row. Course locals are mostly w-sized: read 8 bytes at a time,
 *  two int locals print as one number, the second in the top half. */
type SlotWidth = 8 | 4;

export function StackPanel({ sp, getMemory, fp, frameSlots = [] }: StackPanelProps) {
  // A genuinely-zero SP (broken prologue, x29 never set) is real state, not
  // a parse failure: `|| STACK_BASE` would hide the one anomaly this panel
  // exists to show.
  const parsedSp = parseInt(sp, 16);
  const spVal = Number.isNaN(parsedSp) ? STACK_BASE : parsedSp;
  const data = getMemory(spVal, BYTES_TO_SHOW);
  const zoom = useZoom("stack");

  // Read after mount, since the server has no storage; a reducer, so the
  // stored choice can arrive from an effect.
  const [width, setWidth] = useReducer((_prev: SlotWidth, next: SlotWidth) => next, 8);
  useEffect(() => {
    if (safeGetItem(WIDTH_KEY) === "4") setWidth(4);
  }, []);
  const pickWidth = (next: SlotWidth) => {
    setWidth(next);
    safeSetItem(WIDTH_KEY, String(next));
  };
  const rows = BYTES_TO_SHOW / width;

  const fpVal = fp ?? 0;
  const fpInView = fpVal >= spVal && fpVal < spVal + BYTES_TO_SHOW;

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
        <span className="text-[var(--text-secondary)] text-[12px] uppercase tracking-wider">
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
        <div
          role="group"
          aria-label="slot size"
          className="ml-auto inline-flex shrink-0 items-stretch overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
        >
          {([8, 4] as const).map((w, i) => (
            <button
              key={w}
              type="button"
              aria-pressed={width === w}
              onClick={() => pickWidth(w)}
              className={`shrink-0 whitespace-nowrap px-2 py-0.5 font-mono text-[12px] transition-colors focus:outline-none focus-visible:[box-shadow:var(--ring)] focus-visible:z-10 min-h-[22px] [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] ${
                i > 0 ? "border-l border-[var(--border)]" : ""
              } ${
                width === w
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {w * 8}-bit
            </button>
          ))}
        </div>
        <ZoomControl
          scale={zoom.scale}
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onReset={zoom.reset}
        />
      </div>

      <table className="w-full font-mono">
        <thead>
          <tr className="text-[var(--text-secondary)]">
            <th className="text-left">address</th>
            <th className="text-left pl-4">value ({width * 8}-bit)</th>
            <th className="hidden sm:table-cell text-left pl-4">label</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => {
            const offset = row * width;
            const addr = spVal + offset;
            const slice = data.slice(offset, offset + width);

            // little-endian
            let val = BigInt(0);
            for (let i = width - 1; i >= 0; i--) {
              val = (val << BigInt(8)) | BigInt(slice[i] ?? 0);
            }
            const hex = width === 8 ? formatWord64(val) : formatWord32(Number(val));
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
                  {/* The offset stays beside the name: a wrong offset among
                      the locals is the bug this column helps find. */}
                  {label ? (
                    <span>
                      [fp, {fpOffset}] <span className="text-[var(--text-primary)]">{label}</span>
                    </span>
                  ) : isFpRow ? (
                    <span className="text-[var(--success)]">fp</span>
                  ) : fpOffset !== null && fpOffset > 0 ? (
                    <span>[fp, {fpOffset}]</span>
                  ) : (
                    <span>SP+{offset}</span>
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
