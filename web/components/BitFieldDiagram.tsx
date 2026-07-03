"use client";

import { useMemo, useState } from "react";

export interface BitField {
  /** Width of the field in bits; the box width is proportional to this. */
  bits: number;
  /** Short field name shown in the box, e.g. "opcode", "Rn", "Rd". */
  label: string;
  /** Optional explicit accent color (a CSS color or a token reference like
   *  `var(--cyan)`). Falls back to a token-driven neutral cap when omitted. */
  color?: string;
  /** Worked-example bits for this field ("10011"); length must equal `bits`.
   *  When every field carries one, the diagram turns interactive. */
  value?: string;
  /** What the worked bits decode to, e.g. "x19" or "16 / 8 = 2". */
  meaning?: string;
}

export interface BitFieldDiagramProps {
  /** The encoding to draw. Defaults to a sample 32-bit data-processing encoding
   *  so the diagram renders standalone; the instruction reference reuses it with
   *  a real per-instruction spec, keeping one source of truth for the visual. */
  fields?: BitField[];
  /** Accessible name for the diagram. */
  label?: string;
  /** The concrete instruction the worked bits encode, shown as the caption. */
  asm?: string;
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

/** Amber = the machine's bits: the traced field lights in the word readout. */
const TRACE_STYLE = {
  backgroundColor: "color-mix(in srgb, var(--amber) 22%, transparent)",
} as const;

const FIELD_LI =
  "flex min-w-0 flex-col border-l border-l-[var(--border)] border-t-[3px] border-t-[var(--border-strong)] text-center first:border-l-0";

/**
 * Bit-field encoding diagram: a horizontal row of labeled boxes whose widths
 * are proportional to their bit counts (`flex-grow: bits` over a zero basis, so
 * width tracks bits regardless of label length). A field's top cap takes its
 * `color` when given, else a token-driven neutral, so colors stay theme-aware.
 *
 * With worked values it becomes the course's by-hand encoding exercise in
 * reverse: hover or focus a field and its bits light up inside the full 32-bit
 * word, which is regrouped into nibbles with the hex digit under each -- the
 * exact pack-then-read-hex procedure exams ask for. The trace highlight is a
 * discrete state (no animation), so reduced motion needs no fallback.
 */
export function BitFieldDiagram({
  fields = SAMPLE_FIELDS,
  label = "instruction encoding",
  asm,
  className = "",
}: BitFieldDiagramProps) {
  const [active, setActive] = useState<number | null>(null);
  const worked = useMemo(() => buildWorkedWord(fields), [fields]);

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

      <ul className="flex w-full overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)]">
        {fields.map((field, index) => (
          <li
            key={index}
            style={{
              flexGrow: field.bits,
              flexBasis: 0,
              borderTopColor: field.color,
            }}
            className={FIELD_LI}
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
                <span className="w-full truncate font-mono text-[12px] text-[var(--text-primary)]">
                  {field.label}
                </span>
                <span className="w-full truncate font-mono text-[11px] text-[var(--text-secondary)]">
                  {field.value}
                </span>
              </button>
            ) : (
              <span className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2">
                <span className="w-full truncate font-mono text-[12px] text-[var(--text-primary)]">
                  {field.label}
                </span>
                <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                  {field.bits}
                </span>
              </span>
            )}
          </li>
        ))}
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
