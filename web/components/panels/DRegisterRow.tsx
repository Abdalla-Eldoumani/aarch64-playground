"use client";

/**
 * One floating-point register row: name / alias / value columns matching
 * RegisterRow's grammar. The primary value is the decimal double decoded
 * from the register's raw IEEE-754 bit pattern; the raw bits ride beneath
 * it in tertiary mono (or swap places in hex mode). On a write the row
 * plays the same write-bar strike as the integer rows, with the
 * amber edge bar; under prefers-reduced-motion the `--changed` ink alone
 * carries the state.
 */
export interface DRegisterRowProps {
  /** Register index 0-31 (d0-d31). */
  index: number;
  /** Raw IEEE-754 bit pattern as "0x…" hex. */
  bitsHex: string;
  /** Show the raw hex as the primary value instead of the decimal. */
  hexMode?: boolean;
  changed?: boolean;
}

/** AAPCS64 aliases: d0-d7 carry float arguments and results; d8-d15 are
 *  callee-saved. The rest have no conventional alias. */
function fpAlias(index: number): string | undefined {
  if (index <= 7) return `arg${index}`;
  if (index <= 15) return "save";
  return undefined;
}

function formatFloat(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (!Number.isFinite(value)) return value > 0 ? "+inf" : "-inf";
  // Integral floats print with one decimal so they still read as floats.
  if (Number.isInteger(value) && Math.abs(value) < 1e15) {
    return `${value.toFixed(1)}`;
  }
  return `${value}`;
}

/** Decimal rendering of the register's value. An S write zeroes the top
 *  32 bits, so a pattern living entirely in the low half is read as the
 *  f32 the program put there (suffixed `f`, C float style) -- the f64
 *  reading of such bits would be a meaningless denormal. Everything else
 *  reads as the double it is. */
function decodeFp(bitsHex: string): string {
  try {
    const bits = BigInt(bitsHex);
    if (bits !== 0n && bits <= 0xffff_ffffn) {
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setUint32(0, Number(bits));
      return `${formatFloat(new DataView(buffer).getFloat32(0))}f`;
    }
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, bits);
    return formatFloat(new DataView(buffer).getFloat64(0));
  } catch {
    return "0.0";
  }
}

export function DRegisterRow({
  index,
  bitsHex,
  hexMode = false,
  changed = false,
}: DRegisterRowProps) {
  const decimal = decodeFp(bitsHex);
  const primary = hexMode ? bitsHex : decimal;
  const secondary = hexMode ? decimal : bitsHex;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 rounded-[var(--radius-control)] px-2 py-1 ${
        changed
          ? "anim-reg-flash [box-shadow:inset_2px_0_0_0_var(--amber)]"
          : ""
      }`}
    >
      <span className="w-10 shrink-0 font-mono text-[13px] text-[var(--text-secondary)]">
        D{index}
      </span>
      <span className="w-11 shrink-0 text-left font-mono text-[12px] text-[var(--text-secondary)]">
        {fpAlias(index) ?? ""}
      </span>
      <span className="ml-auto flex min-w-0 flex-col items-end text-right">
        <span
          title={secondary}
          className={`font-mono text-[13px] tabular-nums ${
            changed ? "text-[var(--changed)]" : "text-[var(--text-primary)]"
          }`}
        >
          {primary}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
          {secondary}
        </span>
      </span>
    </div>
  );
}
