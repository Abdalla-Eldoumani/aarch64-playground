"use client";

export interface BitField {
  /** Width of the field in bits; the box width is proportional to this. */
  bits: number;
  /** Short field name shown in the box, e.g. "opcode", "Rn", "Rd". */
  label: string;
  /** Optional explicit accent color (a CSS color or a token reference like
   *  `var(--cyan)`). Falls back to a token-driven neutral cap when omitted. */
  color?: string;
}

export interface BitFieldDiagramProps {
  /** The encoding to draw. Defaults to a sample 32-bit data-processing encoding
   *  so the diagram renders standalone; the instruction reference reuses it with
   *  a real per-instruction spec, keeping one source of truth for the visual. */
  fields?: BitField[];
  /** Accessible name for the diagram. */
  label?: string;
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

/**
 * Bit-field encoding diagram: a horizontal row of labeled boxes whose widths
 * are proportional to their bit counts (`flex-grow: bits` over a zero basis, so
 * width tracks bits regardless of label length). A field's top cap takes its
 * `color` when given, else a token-driven neutral, so colors stay theme-aware.
 */
export function BitFieldDiagram({
  fields = SAMPLE_FIELDS,
  label = "instruction encoding",
  className = "",
}: BitFieldDiagramProps) {
  return (
    <ul
      aria-label={label}
      className={`flex w-full overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] ${className}`}
    >
      {fields.map((field, index) => (
        <li
          key={index}
          style={{ flexGrow: field.bits, flexBasis: 0, borderTopColor: field.color }}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 border-l border-l-[var(--border)] border-t-[3px] border-t-[var(--border-strong)] px-1 py-2 text-center first:border-l-0"
        >
          <span className="truncate font-mono text-[12px] text-[var(--text-primary)]">
            {field.label}
          </span>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">{field.bits}</span>
        </li>
      ))}
    </ul>
  );
}
