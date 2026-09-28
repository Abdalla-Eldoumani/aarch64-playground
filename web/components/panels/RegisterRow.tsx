"use client";

export interface RegisterRowProps {
  /** Register name, e.g. "X0", "SP", "PC". */
  name: string;
  /** ABI / calling-convention alias, e.g. "arg0", "fp", "lr". Optional; the
   *  column is still rendered when absent so values stay aligned across rows. */
  alias?: string;
  /** Formatted value, typically hex such as "0x0000000000000001". */
  value: string;
  /** A second reading of the same bits, shown beneath the value in a smaller
   *  tertiary line. The x-view's decimal mode puts the unsigned reading here
   *  when it differs from the signed one; omitted, the row is one line. */
  secondary?: string;
  /** When true the row plays the write flash and tints the value with
   *  `--changed`; the parent sets it for the step in which the register wrote. */
  changed?: boolean;
}

/**
 * One register row. Sizes are em and ch so the panel's zoom scales it. A
 * wrapping flex line, not a grid, so a value too long for its column drops to
 * its own line instead of painting over the next one. The alias stays at full
 * opacity on --text-secondary so it clears WCAG AA contrast.
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
      // The 2px amber edge bar marks a write and the flash settles into it;
      // the --changed ink on the value keeps the write readable after the
      // motion ends, or with reduced motion on.
      className={`flex flex-wrap items-center gap-x-[0.5ch] rounded-[var(--radius-control)] px-1.5 py-0.5 font-mono leading-[1.25] ${
        changed
          ? "anim-reg-flash [box-shadow:inset_2px_0_0_0_var(--amber)]"
          : ""
      }`}
    >
      <span className="w-[3ch] shrink-0 text-[var(--text-secondary)]">{name}</span>
      <span className="w-[4ch] shrink-0 text-left text-[0.9167em] text-[var(--text-secondary)]">
        {alias ?? ""}
      </span>
      <span className="ml-auto flex min-w-0 flex-col items-end text-right">
        <span
          title={value}
          className={`tabular-nums ${
            changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
          }`}
        >
          {value}
        </span>
        {secondary ? (
          <span className="text-[0.8334em] tabular-nums text-[var(--text-tertiary)]">
            {secondary}
          </span>
        ) : null}
      </span>
    </div>
  );
}
