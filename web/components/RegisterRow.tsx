"use client";

export interface RegisterRowProps {
  /** Register name, e.g. "X0", "SP", "PC". */
  name: string;
  /** ABI / calling-convention alias, e.g. "arg0", "fp", "lr". Optional; the
   *  column is still rendered when absent so values stay aligned across rows. */
  alias?: string;
  /** Formatted value, typically hex such as "0x0000000000000001". */
  value: string;
  /** When true the row plays the write flash and tints the value with
   *  `--changed`; the parent sets it for the step in which the register wrote. */
  changed?: boolean;
}

/**
 * One register row: name / alias / value columns. The value uses tabular
 * figures so hex digits line up down the column. On a write the row plays the
 * `anim-reg-flash` keyframe, a tint read from `--changed` so the flash follows
 * the theme (never a hardcoded amber); the keyframe lives inside a
 * `prefers-reduced-motion: no-preference` block, so under reduced motion the row
 * is static and the value's `--changed` tint is the only indicator. The alias
 * stays on `--text-secondary` at full opacity so it clears WCAG AA (not a faded
 * label).
 */
export function RegisterRow({ name, alias, value, changed = false }: RegisterRowProps) {
  return (
    <div
      className={`grid grid-cols-[2.5rem_2.75rem_1fr] items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 ${
        changed ? "anim-reg-flash" : ""
      }`}
    >
      <span className="font-mono text-[13px] text-[var(--text-secondary)]">{name}</span>
      <span className="text-left font-mono text-[12px] text-[var(--text-secondary)]">
        {alias ?? ""}
      </span>
      <span
        className={`text-right font-mono text-[13px] tabular-nums ${
          changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
