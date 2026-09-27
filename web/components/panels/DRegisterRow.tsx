"use client";

import { fpRegisterText } from "@/lib/emulator/register-format";

/**
 * One floating-point register row: name / alias / value columns matching
 * RegisterRow's grammar and sizing. Decimal mode shows the double decoded
 * from the register's raw IEEE-754 bits (or the float, for a pattern an `s`
 * write left); hex mode shows the raw bits and nothing else. On a write the
 * row plays the same write-bar strike as the integer rows, with the amber
 * edge bar; under prefers-reduced-motion the `--changed` ink alone carries
 * the state.
 */
export interface DRegisterRowProps {
  /** Register index 0-31 (d0-d31). */
  index: number;
  /** Raw IEEE-754 bit pattern as "0x…" hex. */
  bitsHex: string;
  /** Show the raw hex instead of the decimal. */
  hexMode?: boolean;
  /** The last write was spelled `dN`: read the bits as a double even when
   *  only the low 32 are set. */
  asDouble?: boolean;
  changed?: boolean;
}

/** AAPCS64 aliases: d0-d7 carry float arguments and results; d8-d15 are
 *  callee-saved. The rest have no conventional alias. */
function fpAlias(index: number): string | undefined {
  if (index <= 7) return `arg${index}`;
  if (index <= 15) return "save";
  return undefined;
}

export function DRegisterRow({
  index,
  bitsHex,
  hexMode = false,
  asDouble = false,
  changed = false,
}: DRegisterRowProps) {
  const value = hexMode ? bitsHex : fpRegisterText(bitsHex, asDouble);
  return (
    <div
      className={`flex flex-wrap items-center gap-x-[0.5ch] rounded-[var(--radius-control)] px-1.5 py-0.5 font-mono leading-[1.25] ${
        changed
          ? "anim-reg-flash [box-shadow:inset_2px_0_0_0_var(--amber)]"
          : ""
      }`}
    >
      <span className="w-[3ch] shrink-0 text-[var(--text-secondary)]">D{index}</span>
      <span className="w-[4ch] shrink-0 text-left text-[0.9167em] text-[var(--text-secondary)]">
        {fpAlias(index) ?? ""}
      </span>
      <span
        title={value}
        className={`ml-auto min-w-0 text-right tabular-nums ${
          changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
