"use client";

import { useZoom } from "@/lib/use-zoom";
import { ZoomControl } from "@/components/ZoomControl";
import { labelForOffset, type StackSlot } from "@/lib/frame-labels";

interface StackPanelProps {
  sp: string;
  getMemory: (addr: number, len: number) => Uint8Array;
  fp?: number;
  frameSlots?: StackSlot[];
}

const STACK_BASE = 0x80000000;
const ROWS_TO_SHOW = 16;

export function StackPanel({ sp, getMemory, fp, frameSlots = [] }: StackPanelProps) {
  const spVal = parseInt(sp, 16) || STACK_BASE;
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
        <span className="font-mono text-[var(--accent)]">
          SP = 0x{spVal.toString(16).padStart(16, "0")}
        </span>
        {fpVal > 0 && (
          <span className="font-mono text-[var(--text-secondary)]">
            FP = 0x{fpVal.toString(16).padStart(16, "0")}
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
            const hex = "0x" + val.toString(16).padStart(16, "0");
            const isZero = val === BigInt(0);

            const fpOffset = fpInView && fpVal > 0 ? addr - fpVal : null;
            const label =
              fpOffset !== null && fpOffset >= 0
                ? labelForOffset(frameSlots, fpOffset)
                : null;
            const isFpRow = fpInView && addr === fpVal;
            const rowClass = row === 0
              ? "text-[var(--accent)]"
              : isFpRow
                ? "text-[var(--success)]"
                : "";

            return (
              <tr
                key={row}
                className={`hover:bg-[var(--bg-secondary)] ${rowClass}`}
              >
                <td className="text-[var(--text-secondary)]">
                  0x{addr.toString(16).padStart(8, "0")}
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
