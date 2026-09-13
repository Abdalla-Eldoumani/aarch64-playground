"use client";

export interface RegisterRowProps {
  /** Register name, e.g. "X0", "SP", "PC". */
  name: string;
  /** ABI / calling-convention alias, e.g. "arg0", "fp", "lr". Optional; the
   *  column is still rendered when absent so values stay aligned across rows. */
  alias?: string;
  /** Formatted value, typically hex such as "0x0000000000000001". */
  value: string;
  /** A second reading of the same bits, shown beneath the value in tertiary
   *  mono. The x-view's decimal mode puts the unsigned reading here beside the
   *  signed one; omitted, the row is the single-value row it has always been. */
  secondary?: string;
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
 * write the row plays the `anim-reg-flash` keyframe: the amber write bar
 * strikes in wide and settles into the static 2px edge. The keyframe lives
 * inside a `prefers-reduced-motion: no-preference` block, so under reduced
 * motion the row is static and the bar plus the value's `--changed` ink are
 * the indicators. The alias stays on `--text-secondary` at full opacity so
 * it clears WCAG AA.
 */
export function RegisterRow({
  name,
  alias,
  value,
  secondary,
  changed = false,
}: RegisterRowProps) {
  return (
    <div
      // The 2px amber edge bar is the machine's write marker; the flash
      // above strikes into it, and the --changed ink on the value keeps
      // the write readable after the motion ends.
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
      <span className="ml-auto flex min-w-0 flex-col items-end text-right">
        <span
          title={value}
          className={`font-mono text-[13px] tabular-nums ${
            changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
          }`}
        >
          {value}
        </span>
        {secondary ? (
          <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
            {secondary}
          </span>
        ) : null}
      </span>
    </div>
  );
}
