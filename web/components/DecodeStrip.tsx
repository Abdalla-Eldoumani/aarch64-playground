"use client";

import { useMemo } from "react";
import { describeLine, extractAliases } from "@/lib/explain-line";
import { decodeFields } from "@/lib/decode-fields";

export interface DecodeStripProps {
  /** Full source text -- needed to extract the line the CPU is on. */
  source: string;
  /** 1-based line of the most recently executed (or about-to-execute) instruction, or null. */
  currentLine: number | null;
  /** The machine word at the program counter, as "0x…" hex, or null before assembly. */
  encodingHex?: string | null;
  /** Compact drops the field row's per-cell meanings (the hero embed header). */
  compact?: boolean;
}

/**
 * The live decode strip: the flagship panel that renders the instruction
 * under the program counter as its actual 32-bit encoding, sliced into
 * labeled field boxes, with the plain-language gloss underneath. The
 * destination field (the register the machine is about to write) reads
 * amber — the machine acting — and the whole field row re-latches on every
 * step (`anim-decode-latch`, static under reduced motion). Field layouts
 * come from lib/decode-fields, which is pinned to the real assembler by its
 * tests; unrecognized words render as one unsplit box so the strip never
 * invents structure.
 */
export function DecodeStrip({
  source,
  currentLine,
  encodingHex = null,
  compact = false,
}: DecodeStripProps) {
  const aliases = useMemo(() => extractAliases(source), [source]);

  const gloss = useMemo(() => {
    if (currentLine == null) return null;
    const raw = source.split("\n")[currentLine - 1] ?? "";
    return describeLine(raw, aliases);
  }, [source, currentLine, aliases]);

  const decoded = useMemo(() => {
    if (!encodingHex) return null;
    const word = Number.parseInt(encodingHex, 16);
    if (!Number.isFinite(word)) return null;
    return decodeFields(word);
  }, [encodingHex]);

  return (
    <div
      className="w-full flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-raised)]"
      aria-label="current instruction"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono font-medium uppercase tracking-[0.14em] text-[10px] text-[var(--text-secondary)]">
          current instruction
        </span>
        {decoded && encodingHex ? (
          <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
            {encodingHex}
          </span>
        ) : null}
      </div>

      {decoded ? (
        // Keyed by the encoding so each step re-latches the field row.
        <div
          key={`${encodingHex}-${currentLine}`}
          className="flex w-full overflow-x-auto"
          role="img"
          aria-label={`instruction encoding ${encodingHex ?? ""}`}
        >
          {decoded.fields.map((field, index) => {
            const dest = index === decoded.destIndex;
            return (
              <div
                key={`${field.label}-${index}`}
                className={`anim-decode-latch flex min-w-0 flex-col items-center border py-1 ${
                  dest
                    ? "border-[var(--amber)] z-10"
                    : "border-[var(--border)]"
                } ${index > 0 ? "-ml-px" : ""}`}
                style={{
                  flexGrow: field.bits,
                  // Floor per field so 1-bit boxes keep their labels legible;
                  // the row scrolls horizontally when floors overflow.
                  flexBasis: `${Math.max(34, field.bits * 8)}px`,
                  backgroundColor: dest
                    ? "color-mix(in srgb, var(--amber) 8%, transparent)"
                    : undefined,
                }}
              >
                <span
                  className={`px-1 font-mono text-[9px] uppercase tracking-[0.1em] ${
                    dest ? "text-[var(--amber)]" : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {field.label}
                </span>
                <span
                  className={`px-1 font-mono text-[12px] font-medium tabular-nums break-all ${
                    dest
                      ? "text-[var(--amber)]"
                      : field.kind === "register"
                        ? "text-[var(--syntax-register)]"
                        : field.kind === "immediate"
                          ? "text-[var(--syntax-number)]"
                          : "text-[var(--text-primary)]"
                  }`}
                >
                  {field.value}
                </span>
                {!compact && field.meaning ? (
                  <span
                    className={`px-1 font-mono text-[9px] ${
                      dest
                        ? "text-[var(--amber)]"
                        : field.kind === "register"
                          ? "text-[var(--syntax-register)]"
                          : "text-[var(--text-tertiary)]"
                    }`}
                  >
                    {field.meaning}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {gloss ? (
        // Keyed by the line so each step replays the register-write flash on
        // the gloss: the strip is machine state, and it pulses with the same
        // --changed tint as a written register. Under prefers-reduced-motion
        // the class is inert and the updated text alone carries the change.
        <span
          key={currentLine}
          className="anim-reg-flash -mx-1 rounded-[var(--radius-control)] px-1 font-mono text-[13px] leading-[1.6] text-[var(--text-primary)] break-words"
        >
          {gloss}
        </span>
      ) : (
        <span className="font-mono text-[13px] leading-[1.6] text-[var(--text-tertiary)]">
          step the program to see the current instruction
        </span>
      )}
    </div>
  );
}
