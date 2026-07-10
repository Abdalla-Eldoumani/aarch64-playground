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
 * figures so hex digits line up down the column. The row is a wrap-capable
 * flex line rather than a rigid grid: an 18-character hex value cannot
 * shrink, so in a panel narrower than one full line it reflows onto its own
 * right-aligned line under the name and alias instead of painting into the
 * neighboring column; `title` keeps the full value one hover away. On a
 * write the row plays the `anim-reg-flash` keyframe, a tint read from
 * `--changed` so the flash follows the theme (never a hardcoded amber); the
 * keyframe lives inside a `prefers-reduced-motion: no-preference` block, so
 * under reduced motion the row is static and the value's `--changed` tint is
 * the only indicator. The alias stays on `--text-secondary` at full opacity
 * so it clears WCAG AA (not a faded label).
 */
export function RegisterRow({ name, alias, value, changed = false }: RegisterRowProps) {
  return (
    <div
      // A written row also carries a 2px amber edge bar -- the machine's
      // write marker -- alongside the --changed tint, so the write reads
      // even while the background flash fades.
      className={`flex flex-wrap items-center gap-x-2 rounded-[var(--radius-control)] px-2 py-1 ${
        changed
          ? "anim-reg-flash [box-shadow:inset_2px_0_0_0_var(--amber)]"
          : ""
      }`}
    >
      <span className="w-10 shrink-0 font-mono text-[13px] text-[var(--text-secondary)]">
        {name}
      </span>
      <span className="w-11 shrink-0 text-left font-mono text-[12px] text-[var(--text-secondary)]">
        {alias ?? ""}
      </span>
      <span
        title={value}
        className={`ml-auto text-right font-mono text-[13px] tabular-nums ${
          changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
