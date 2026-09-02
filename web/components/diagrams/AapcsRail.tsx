import type { JSX } from "react";

/**
 * The reference page's AAPCS64 register-file rail: a narrow stacked column of
 * bordered rows mapping the register file to its ABI roles, tinted by the
 * site's two-pole logic: cyan for the registers that are yours to pass and
 * receive, amber for the ones the callee must preserve, a 60% fade for the
 * platform registers to leave alone. Purely presentational: the nine rows
 * are the content (the full AAPCS64 role map), so they live here rather than
 * in a data module, and nothing reads live debugger state. Token-only, so all
 * three themes resolve from the same markup.
 */

type Tint = "cyan" | "neutral" | "muted" | "amber" | "amber-strong";

interface RailRow {
  /** Register range, mono, e.g. "x0 – x7". */
  range: string;
  /** Uppercase role note, e.g. "arguments · results". */
  note: string;
  tint: Tint;
}

const ROWS: RailRow[] = [
  { range: "x0 – x7", note: "arguments · results", tint: "cyan" },
  { range: "x8", note: "indirect result", tint: "neutral" },
  { range: "x9 – x15", note: "caller-saved temps", tint: "neutral" },
  { range: "x16 – x18", note: "platform · avoid", tint: "muted" },
  { range: "x19 – x28", note: "callee-saved", tint: "amber" },
  { range: "x29 · x30", note: "fp · lr (the frame record)", tint: "amber-strong" },
  { range: "d0 – d7", note: "float args · results", tint: "cyan" },
  { range: "d8 – d15", note: "callee-saved", tint: "amber" },
  { range: "d16 – d31", note: "caller-saved float temps", tint: "neutral" },
];

/** Per-tint chrome: border and range ink; the note stays quiet throughout. */
const TINT: Record<Tint, { row: string; range: string; note: string }> = {
  cyan: {
    row: "border-[color-mix(in_srgb,var(--cyan)_45%,transparent)] bg-[color-mix(in_srgb,var(--cyan)_8%,transparent)]",
    range: "text-[var(--cyan)]",
    note: "text-[var(--text-secondary)]",
  },
  neutral: {
    row: "border-[var(--border)]",
    range: "text-[var(--text-primary)]",
    note: "text-[var(--text-tertiary)]",
  },
  muted: {
    row: "border-[var(--border)] opacity-60",
    range: "text-[var(--text-primary)]",
    note: "text-[var(--text-tertiary)]",
  },
  amber: {
    row: "border-[color-mix(in_srgb,var(--amber)_45%,transparent)] bg-[color-mix(in_srgb,var(--amber)_7%,transparent)]",
    range: "text-[var(--amber)]",
    note: "text-[var(--text-secondary)]",
  },
  "amber-strong": {
    row: "border-[var(--amber)]",
    range: "text-[var(--amber)]",
    note: "text-[var(--text-secondary)]",
  },
};

export function AapcsRail({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <aside
      aria-label="aapcs64 register file rail"
      className={`flex w-full flex-col gap-2 ${className}`}
    >
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        register file · aapcs64
      </h2>
      <ul className="flex flex-col gap-2">
        {ROWS.map((row) => (
          <li
            key={row.range}
            className={`flex min-h-[40px] items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 py-1 ${TINT[row.tint].row}`}
          >
            {/* The register name is the row's identity, so it never wraps; the
                role note takes the second line instead, which the row's
                min-height already has room for. */}
            <span
              className={`shrink-0 whitespace-nowrap font-mono text-[13px] font-medium ${TINT[row.tint].range}`}
            >
              {row.range}
            </span>
            <span
              className={`min-w-0 text-right font-mono text-[10px] uppercase leading-tight tracking-[0.06em] ${TINT[row.tint].note}`}
            >
              {row.note}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 font-serif text-[13px] italic leading-relaxed text-[var(--text-secondary)]">
        Amber = the callee must preserve it. Cyan = yours to pass and receive.
        Each <span className="font-mono not-italic">x</span> row is one register
        with a <span className="font-mono not-italic">w</span> view of its low
        32 bits, and each <span className="font-mono not-italic">d</span> row is
        one register with an{" "}
        <span className="font-mono not-italic">s</span> view of its low 32 bits.
      </p>
    </aside>
  );
}
