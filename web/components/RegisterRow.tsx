"use client";

import { motion, useReducedMotion } from "motion/react";

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
 * figures so hex digits line up down the column. On a write the row flashes a
 * tint read from `--changed` (so the flash follows the theme, never a hardcoded
 * amber); under `prefers-reduced-motion` the flash overlay is dropped and the
 * value's static `--changed` tint is the only indicator. The alias stays on
 * `--text-secondary` at full opacity so it clears WCAG AA (not a faded label).
 */
export function RegisterRow({ name, alias, value, changed = false }: RegisterRowProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative grid grid-cols-[2.5rem_2.75rem_1fr] items-center gap-2 rounded-[var(--radius-control)] px-2 py-1">
      {changed && !reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[var(--radius-control)] bg-[var(--changed)]"
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 0 }}
          // ~120ms in / ~480ms out per the register-flash motion scale.
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        />
      )}
      <span className="relative font-mono text-[13px] text-[var(--text-secondary)]">{name}</span>
      <span className="relative text-left font-mono text-[12px] text-[var(--text-secondary)]">
        {alias ?? ""}
      </span>
      <span
        className={`relative text-right font-mono text-[13px] tabular-nums ${
          changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
