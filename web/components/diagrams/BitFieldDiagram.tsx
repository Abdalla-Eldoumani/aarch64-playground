"use client";

import { useMemo, useState } from "react";
import type { BitField } from "@/lib/content/reference-data";

export interface BitFieldDiagramProps {
  /** The encoding to draw. Defaults to a sample 32-bit data-processing encoding
   *  so the diagram renders standalone; the instruction reference reuses it with
   *  a real per-instruction spec, keeping one source of truth for the visual. */
  fields?: BitField[];
  /** Accessible name for the diagram. */
  label?: string;
  /** The concrete instruction the worked bits encode, shown as the caption. */
  asm?: string;
  /** Reference-size chrome, off by default so existing callers are untouched:
   *  each field gains a top line with its bit range ("30 : 21"), computed
   *  right-to-left from bit 31, and the destination field (the datasheet's
   *  "the machine is about to write here" convention: label `Rd`) takes the
   *  amber treatment (1px amber border, 8% amber fill, amber ink). */
  bitHeaders?: boolean;
  className?: string;
}

// A recognizable ARMv8 add (shifted register) layout that sums to 32 bits.
const SAMPLE_FIELDS: BitField[] = [
  { bits: 11, label: "opcode" },
  { bits: 5, label: "Rm" },
  { bits: 6, label: "imm6" },
  { bits: 5, label: "Rn" },
  { bits: 5, label: "Rd" },
];

interface WorkedWord {
  /** Owning field index per bit, msb first. */
  owners: number[];
  /** The 32 bit characters, msb first. */
  chars: string[];
  /** Lowercase hex of the assembled word, 8 digits. */
  hex: string;
}

/**
 * The worked readout exists only when every field carries a bit string and the
 * widths add up to one 32-bit word; otherwise the diagram stays static.
 */
function buildWorkedWord(fields: BitField[]): WorkedWord | null {
  if (fields.some((field) => field.value === undefined)) return null;
  const owners: number[] = [];
  const chars: string[] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    const value = field.value ?? "";
    if (value.length !== field.bits || /[^01]/.test(value)) return null;
    for (const char of value) {
      owners.push(index);
      chars.push(char);
    }
  }
  if (chars.length !== 32) return null;
  const word = parseInt(chars.join(""), 2);
  return { owners, chars, hex: word.toString(16).padStart(8, "0") };
}

/**
 * Per-field bit ranges, msb first from bit 31 (the printed "30 : 21" headers
 * of the reference size). A single-bit field prints just its bit number.
 */
function buildBitRanges(fields: BitField[]): string[] {
  let hi = 31;
  return fields.map((field) => {
    const lo = hi - field.bits + 1;
    const text = field.bits === 1 ? `${hi}` : `${hi} : ${lo}`;
    hi = lo - 1;
    return text;
  });
}

/** The destination convention: the data marks the written register as `Rd`. */
function isDestination(field: BitField): boolean {
  return field.label === "Rd";
}

/** Amber = the machine's bits: the traced field lights in the word readout. */
const TRACE_STYLE = {
  backgroundColor: "color-mix(in srgb, var(--amber) 22%, transparent)",
} as const;

const FIELD_LI =
  "flex min-w-0 flex-col border-l border-l-[var(--border)] border-t-[3px] border-t-[var(--border-strong)] text-center first:border-l-0";
// The amber destination cell: the 1px border rides an inset shadow so the
// shared cell edges and the proportional widths stay untouched.
const FIELD_LI_DEST =
  " [box-shadow:inset_0_0_0_1px_var(--amber)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)]";

/**
 * Bit-field encoding diagram: a horizontal row of labeled boxes whose widths
 * are proportional to their bit counts (`flex-grow: bits` over a zero basis, so
 * width tracks bits regardless of label length). A field's top cap takes its
 * `color` when given, else a token-driven neutral, so colors stay theme-aware.
 *
 * With worked values it becomes the course's by-hand encoding exercise in
 * reverse: hover or focus a field and its bits light up inside the full 32-bit
 * word, which is regrouped into nibbles with the hex digit under each, the
 * exact pack-then-read-hex procedure exams ask for. The trace highlight is a
 * discrete state (no animation), so reduced motion needs no fallback.
 */
export function BitFieldDiagram({
  fields = SAMPLE_FIELDS,
  label = "instruction encoding",
  asm,
  bitHeaders = false,
  className = "",
}: BitFieldDiagramProps) {
  const [active, setActive] = useState<number | null>(null);
  const worked = useMemo(() => buildWorkedWord(fields), [fields]);
  const ranges = useMemo(
    () => (bitHeaders ? buildBitRanges(fields) : null),
    [bitHeaders, fields],
  );

  const nibbles = useMemo(() => {
    if (!worked) return [];
    const groups: Array<{ start: number; hexDigit: string }> = [];
    for (let start = 0; start < 32; start += 4) {
      groups.push({
        start,
        hexDigit: worked.hex[start / 4],
      });
    }
    return groups;
  }, [worked]);

  return (
    <div role="group" aria-label={label} className={`flex flex-col gap-3 ${className}`}>
      {asm && worked && (
        <p className="font-mono text-[13px] text-[var(--text-secondary)]">
          <span className="[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]">
            worked encoding{" "}
          </span>
          <span className="text-[var(--text-primary)]">{asm}</span>
        </p>
      )}

      <ul className="flex w-full overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)]">
        {fields.map((field, index) => {
          const dest = bitHeaders && isDestination(field);
          const rangeLine = ranges && (
            <span
              className={`w-full truncate font-mono text-[9px] ${
                dest ? "text-[var(--amber)]" : "text-[var(--text-tertiary)]"
              }`}
            >
              {ranges[index]}
            </span>
          );
          const labelInk = dest
            ? "text-[var(--amber)]"
            : "text-[var(--text-primary)]";
          const valueInk = dest
            ? "text-[var(--amber)]"
            : "text-[var(--text-secondary)]";
          return (
            <li
              key={index}
              style={{
                flexGrow: field.bits,
                // Floor per field: 1-bit boxes stay readable (labels like
                // "sf" and a bit-range header need ~44px); wider fields
                // scale with their bit count.
                flexBasis: `${Math.max(44, field.bits * 22)}px`,
                borderTopColor: dest ? "var(--amber)" : field.color,
              }}
              className={`${FIELD_LI}${dest ? FIELD_LI_DEST : ""}`}
            >
              {worked ? (
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() =>
                    setActive((current) => (current === index ? null : current))
                  }
                  onFocus={() => setActive(index)}
                  onBlur={() =>
                    setActive((current) => (current === index ? null : current))
                  }
                  aria-label={`${field.label}, ${field.bits} bits, ${field.value}${
                    field.meaning ? `, ${field.meaning}` : ""
                  }`}
                  className={`flex min-h-[44px] w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 outline-none transition-colors focus-visible:[box-shadow:var(--ring)] ${
                    active === index
                      ? "bg-[color-mix(in_srgb,var(--amber)_10%,transparent)]"
                      : ""
                  }`}
                >
                  {rangeLine}
                  <span className={`w-full truncate font-mono text-[12px] ${labelInk}`}>
                    {field.label}
                  </span>
                  <span className={`w-full truncate font-mono text-[11px] ${valueInk}`}>
                    {field.value}
                  </span>
                </button>
              ) : (
                <span className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2">
                  {rangeLine}
                  <span className={`w-full truncate font-mono text-[12px] ${labelInk}`}>
                    {field.label}
                  </span>
                  <span className={`font-mono text-[11px] ${valueInk}`}>
                    {field.bits}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {worked && (
        <>
          <div
            aria-label="assembled word"
            className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2 font-mono"
          >
            {nibbles.map((nibble) => (
              <span key={nibble.start} className="flex flex-col items-center gap-0.5">
                <span className="flex text-[13px] text-[var(--text-secondary)]">
                  {[0, 1, 2, 3].map((offset) => {
                    const bitIndex = nibble.start + offset;
                    const traced = worked.owners[bitIndex] === active;
                    return (
                      <span
                        key={offset}
                        style={traced ? TRACE_STYLE : undefined}
                        className={traced ? "text-[var(--text-primary)]" : ""}
                      >
                        {worked.chars[bitIndex]}
                      </span>
                    );
                  })}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {nibble.hexDigit}
                </span>
              </span>
            ))}
            <span className="self-center text-[13px] text-[var(--text-primary)]">
              = 0x{worked.hex}
            </span>
          </div>
          <p
            aria-live="polite"
            className="min-h-[1.5em] font-mono text-[12px] text-[var(--text-secondary)]"
          >
            {active !== null
              ? `${fields[active].label} = ${fields[active].value}${
                  fields[active].meaning ? ` -> ${fields[active].meaning}` : ""
                }`
              : "hover or focus a field to trace its bits into the word; the hex digit under each nibble is how the exam wants it read."}
          </p>
        </>
      )}
    </div>
  );
}
