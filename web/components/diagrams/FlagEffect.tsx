"use client";

/**
 * Interactive NZCV panel for the flag-setting reference entries. The student
 * types the two operand values the instruction would see and the panel shows
 * the arithmetic the machine performs, the four flags it leaves behind, and
 * which conditional branches those flags would take -- signed and unsigned
 * side by side, because reading `b.lt` where `b.lo` was needed is the classic
 * slip. The math here is pure display logic implementing the same NZCV rules
 * the emulator's executor applies; no emulator round trip. Inputs and the
 * width toggle are the user acting (cyan); the computed flags and taken
 * branches are the machine acting (amber). Token-only, keyboard accessible
 * (native inputs and buttons), reduced-motion safe (discrete state swaps,
 * no animation).
 */

import { useId, useMemo, useState, type JSX } from "react";
import { Input } from "@/components/ui/Input";

export type FlagMnemonic =
  | "cmp"
  | "cmn"
  | "tst"
  | "adds"
  | "subs"
  | "ands"
  | "fcmp";

/** The reference entries that set NZCV and so render this panel. */
export const FLAG_SETTERS: ReadonlySet<string> = new Set<string>([
  "cmp",
  "cmn",
  "tst",
  "adds",
  "subs",
  "ands",
  "fcmp",
]);

export interface Flags {
  n: boolean;
  z: boolean;
  c: boolean;
  v: boolean;
}

type IntOp = "sub" | "add" | "and";

/**
 * NZCV for the integer flag-setters at a register width, the same rules the
 * executor applies: N = sign bit of the result, Z = zero, C = no-borrow for
 * subtraction / carry-out for addition / cleared by the logical ops, V =
 * signed overflow (operand signs agree for add, differ for sub, and the
 * result sign disagrees with the first operand).
 */
export function computeIntFlags(
  op: IntOp,
  aIn: bigint,
  bIn: bigint,
  bits: 32 | 64,
): { result: bigint; flags: Flags } {
  const width = BigInt(bits);
  const mask = (1n << width) - 1n;
  const signBit = 1n << (width - 1n);
  const a = aIn & mask;
  const b = bIn & mask;
  let result: bigint;
  let c = false;
  let v = false;
  const signOf = (value: bigint) => (value & signBit) !== 0n;
  if (op === "sub") {
    result = (a - b) & mask;
    c = a >= b;
    v = signOf(a) !== signOf(b) && signOf(result) !== signOf(a);
  } else if (op === "add") {
    const wide = a + b;
    result = wide & mask;
    c = wide > mask;
    v = signOf(a) === signOf(b) && signOf(result) !== signOf(a);
  } else {
    result = a & b;
  }
  return {
    result,
    flags: { n: signOf(result), z: result === 0n, c, v },
  };
}

/**
 * NZCV for `fcmp`: less-than sets N, equal sets Z and C, greater-than sets C,
 * and an unordered compare (either side NaN) sets C and V.
 */
export function computeFcmpFlags(a: number, b: number): Flags {
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { n: false, z: false, c: true, v: true };
  }
  if (a < b) return { n: true, z: false, c: false, v: false };
  if (a === b) return { n: false, z: true, c: true, v: false };
  return { n: false, z: false, c: true, v: false };
}

/** Decimal or 0x hex, optionally negative; null when it is neither. */
export function parseIntOperand(text: string): bigint | null {
  const t = text.trim().toLowerCase();
  if (!/^-?(0x[0-9a-f]+|\d+)$/.test(t)) return null;
  // BigInt() rejects a signed hex literal ("-0x10"), so peel the sign first.
  const negative = t.startsWith("-");
  const magnitude = BigInt(negative ? t.slice(1) : t);
  return negative ? -magnitude : magnitude;
}

/** A plain float, or `nan` to see the unordered compare; null otherwise. */
export function parseFloatOperand(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === "nan") return Number.NaN;
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(t)) return null;
  return Number(t);
}

interface Branch {
  code: string;
  meaning: string;
  taken: (f: Flags) => boolean;
}

const EITHER: Branch[] = [
  { code: "eq", meaning: "equal (z set)", taken: (f) => f.z },
  { code: "ne", meaning: "not equal (z clear)", taken: (f) => !f.z },
];
const SIGNED: Branch[] = [
  { code: "lt", meaning: "signed less than (n differs from v)", taken: (f) => f.n !== f.v },
  { code: "le", meaning: "signed at most (z set, or n differs from v)", taken: (f) => f.z || f.n !== f.v },
  { code: "gt", meaning: "signed greater than (z clear and n matches v)", taken: (f) => !f.z && f.n === f.v },
  { code: "ge", meaning: "signed at least (n matches v)", taken: (f) => f.n === f.v },
];
const UNSIGNED: Branch[] = [
  { code: "lo", meaning: "unsigned lower (c clear)", taken: (f) => !f.c },
  { code: "ls", meaning: "unsigned at most (c clear or z set)", taken: (f) => !f.c || f.z },
  { code: "hi", meaning: "unsigned higher (c set and z clear)", taken: (f) => f.c && !f.z },
  { code: "hs", meaning: "unsigned at least (c set)", taken: (f) => f.c },
];

interface OpConfig {
  op: IntOp | "fcmp";
  /** Spells the demo instruction with the panel's register names. */
  spell: (a: string, b: string) => string;
  /** One-line course-voice framing of what the instruction really does. */
  story: string;
  /** True when only the flags survive (compare / test aliases). */
  discards: boolean;
  defaults: [string, string];
}

// Default operands are chosen to land on the teaching point immediately:
// cmp -1 vs 1 splits the signed and unsigned readings, cmn -1 vs 1 is the
// course's sentinel test, adds tips into signed overflow, tst/ands isolate Z.
const CONFIG: Record<FlagMnemonic, OpConfig> = {
  cmp: {
    op: "sub",
    spell: (a, b) => `cmp ${a}, ${b}`,
    story: "cmp is subs with the result thrown away: the machine subtracts and keeps only the flags.",
    discards: true,
    defaults: ["-1", "1"],
  },
  cmn: {
    op: "add",
    spell: (a, b) => `cmn ${a}, ${b}`,
    story: "cmn adds instead of subtracting, so cmn with 1 asks whether the register holds -1.",
    discards: true,
    defaults: ["-1", "1"],
  },
  tst: {
    op: "and",
    spell: (a, b) => `tst ${a}, ${b}`,
    story: "tst is ands with the result thrown away: it asks which bits survive the mask.",
    discards: true,
    defaults: ["6", "1"],
  },
  subs: {
    op: "sub",
    spell: (a, b) => `subs ${a.replace(/(\d+)$/, "11")}, ${a}, ${b}`,
    story: "the subtraction is kept and the flags describe it; cmp is this with the result discarded.",
    discards: false,
    defaults: ["3", "5"],
  },
  adds: {
    op: "add",
    spell: (a, b) => `adds ${a.replace(/(\d+)$/, "11")}, ${a}, ${b}`,
    story: "the addition is kept and the flags describe it; watch v when two positives make a negative.",
    discards: false,
    defaults: ["0x7fffffff", "1"],
  },
  ands: {
    op: "and",
    spell: (a, b) => `ands ${a.replace(/(\d+)$/, "11")}, ${a}, ${b}`,
    story: "the mask result is kept and z reports whether anything survived; tst is this discarded.",
    discards: false,
    defaults: ["0xf0", "0x0f"],
  },
  fcmp: {
    op: "fcmp",
    spell: (a, b) => `fcmp ${a}, ${b}`,
    story: "the float compare leaves the same nzcv flags integer cmp does, so the same branches read them.",
    discards: true,
    defaults: ["0.3", "0.5"],
  },
};

function hex(value: bigint, bits: 32 | 64): string {
  return `0x${value.toString(16).padStart(bits / 4, "0")}`;
}

function signedReading(value: bigint, bits: 32 | 64): bigint {
  const signBit = 1n << BigInt(bits - 1);
  return (value & signBit) !== 0n ? value - (1n << BigInt(bits)) : value;
}

const PANEL_LABEL =
  "[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]";
const TOGGLE_BASE =
  "min-h-[44px] rounded-[var(--radius-control)] border px-3 font-mono text-[13px] outline-none transition-colors focus-visible:[box-shadow:var(--ring)]";
const TOGGLE_ON =
  "border-[var(--cyan)] bg-[color-mix(in_srgb,var(--cyan)_12%,transparent)] text-[var(--text-primary)]";
const TOGGLE_OFF =
  "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";

/** Amber = the machine acting: a lit flag or a branch the machine would take. */
const LIT_STYLE = {
  borderColor: "var(--amber)",
  backgroundColor: "color-mix(in srgb, var(--amber) 12%, transparent)",
} as const;

const FLAG_WORDS: Record<keyof Flags, string> = {
  n: "negative",
  z: "zero",
  c: "carry",
  v: "overflow",
};

export function FlagEffect({
  mnemonic,
  className = "",
  condHref,
}: {
  mnemonic: FlagMnemonic;
  className?: string;
  /** When set, a footer link jumps to the b.cond entry that explains what
   *  each of the branch chips actually asks; the href is the mount's to
   *  choose so the panel stays independent of any one page's anchors. */
  condHref?: string;
}): JSX.Element {
  const config = CONFIG[mnemonic];
  const isFloat = config.op === "fcmp";
  const [aText, setAText] = useState(config.defaults[0]);
  const [bText, setBText] = useState(config.defaults[1]);
  const [bits, setBits] = useState<32 | 64>(32);
  const aId = useId();
  const bId = useId();

  const regA = isFloat ? "d16" : bits === 32 ? "w9" : "x9";
  const regB = isFloat ? "d17" : bits === 32 ? "w10" : "x10";

  const parsed = useMemo(() => {
    if (isFloat) {
      const a = parseFloatOperand(aText);
      const b = parseFloatOperand(bText);
      return a === null || b === null
        ? null
        : { kind: "float" as const, a, b };
    }
    const a = parseIntOperand(aText);
    const b = parseIntOperand(bText);
    return a === null || b === null ? null : { kind: "int" as const, a, b };
  }, [isFloat, aText, bText]);

  const outcome = useMemo(() => {
    if (!parsed) return null;
    if (parsed.kind === "float") {
      return { flags: computeFcmpFlags(parsed.a, parsed.b), result: null };
    }
    const { result, flags } = computeIntFlags(
      config.op as IntOp,
      parsed.a,
      parsed.b,
      bits,
    );
    return { flags, result };
  }, [parsed, config.op, bits]);

  const groups = useMemo(
    () =>
      isFloat
        ? [{ label: "after fcmp", branches: [...EITHER, ...SIGNED] }]
        : [
            { label: "either sign", branches: EITHER },
            { label: "signed", branches: SIGNED },
            { label: "unsigned", branches: UNSIGNED },
          ],
    [isFloat],
  );

  const opGlyph = config.op === "add" ? "+" : config.op === "and" ? "&" : "-";
  const unordered =
    isFloat && outcome !== null && outcome.flags.c && outcome.flags.v;

  return (
    <section
      aria-label={`${mnemonic} flag effect`}
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <p className={PANEL_LABEL}>what the flags say</p>
        <p className="font-mono text-[15px] text-[var(--text-primary)]">
          {config.spell(regA, regB)}
        </p>
        <p className="[font:var(--type-small)] text-[var(--text-secondary)]">
          {config.story}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1">
          <label htmlFor={aId} className={PANEL_LABEL}>
            {regA}
          </label>
          <Input
            id={aId}
            mono
            value={aText}
            onChange={(event) => setAText(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1">
          <label htmlFor={bId} className={PANEL_LABEL}>
            {regB}
          </label>
          <Input
            id={bId}
            mono
            value={bText}
            onChange={(event) => setBText(event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {!isFloat && (
          <div
            role="group"
            aria-label="operand width"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              aria-pressed={bits === 32}
              onClick={() => setBits(32)}
              className={`${TOGGLE_BASE} ${bits === 32 ? TOGGLE_ON : TOGGLE_OFF}`}
            >
              w 32-bit
            </button>
            <button
              type="button"
              aria-pressed={bits === 64}
              onClick={() => setBits(64)}
              className={`${TOGGLE_BASE} ${bits === 64 ? TOGGLE_ON : TOGGLE_OFF}`}
            >
              x 64-bit
            </button>
          </div>
        )}
      </div>

      {parsed === null || outcome === null ? (
        <p className="[font:var(--type-small)] text-[var(--text-secondary)]">
          {isFloat
            ? "enter a number like 0.5, -2, or nan to see the unordered case."
            : "enter a number, decimal or 0x hex, negative welcome."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 border-l-2 border-[var(--amber)] pl-3 font-mono text-[13px] text-[var(--text-secondary)]">
            {parsed.kind === "int" && outcome.result !== null ? (
              <>
                <p>
                  {regA} {opGlyph} {regB} {"->"}{" "}
                  <span className="text-[var(--text-primary)]">
                    {hex(outcome.result, bits)}
                  </span>{" "}
                  ({signedReading(outcome.result, bits).toString()} signed
                  {" · "}
                  {outcome.result.toString()} unsigned)
                </p>
                <p>
                  {regA} reads as{" "}
                  {signedReading(parsed.a & ((1n << BigInt(bits)) - 1n), bits).toString()}{" "}
                  signed · {(parsed.a & ((1n << BigInt(bits)) - 1n)).toString()}{" "}
                  unsigned -- same bits, two readings
                </p>
                <p className="text-[var(--text-tertiary)]">
                  {config.discards
                    ? "the result is discarded; only the flags remain."
                    : "the result is written; the flags describe it."}
                </p>
              </>
            ) : (
              <p>
                {unordered
                  ? "unordered: one side is nan, so c and v are set -- branches that read v misfire here."
                  : parsed.kind === "float"
                    ? outcome.flags.z
                      ? `${regA} equals ${regB}`
                      : outcome.flags.n
                        ? `${regA} is below ${regB}`
                        : `${regA} is above ${regB}`
                    : ""}
              </p>
            )}
          </div>

          <ul aria-label="flags" className="flex flex-wrap gap-2">
            {(Object.keys(FLAG_WORDS) as Array<keyof Flags>).map((flag) => {
              const lit = outcome.flags[flag];
              return (
                <li
                  key={flag}
                  aria-label={`${flag.toUpperCase()} ${FLAG_WORDS[flag]}: ${lit ? 1 : 0}`}
                  className="flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2"
                  style={lit ? LIT_STYLE : undefined}
                >
                  <span className="font-mono text-[15px] font-semibold text-[var(--text-primary)]">
                    {flag.toUpperCase()} = {lit ? 1 : 0}
                  </span>
                  <span className="[font:var(--type-label)] text-[var(--text-secondary)]">
                    {FLAG_WORDS[flag]}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <div
                key={group.label}
                className="flex flex-wrap items-center gap-2"
              >
                <span className={`${PANEL_LABEL} min-w-[6rem]`}>
                  {group.label}
                </span>
                <ul className="flex flex-wrap gap-2">
                  {group.branches.map((branch) => {
                    const taken = branch.taken(outcome.flags);
                    return (
                      <li
                        key={branch.code}
                        aria-label={`b.${branch.code}: ${taken ? "taken" : "not taken"}`}
                        title={branch.meaning}
                        className={`rounded-[var(--radius-control)] border px-2.5 py-1.5 font-mono text-[13px] ${
                          taken
                            ? "border-[var(--amber)] text-[var(--text-primary)]"
                            : "border-[var(--border)] text-[var(--text-tertiary)]"
                        }`}
                        style={taken ? LIT_STYLE : undefined}
                      >
                        <span aria-hidden="true">{taken ? "●" : "○"}</span>{" "}
                        b.{branch.code}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      {condHref && (
        <a
          href={condHref}
          className="inline-flex min-h-[44px] items-center gap-1 self-start font-mono text-[13px] text-[var(--cyan)] outline-none hover:underline focus-visible:[box-shadow:var(--ring)]"
        >
          what each of these conditions really asks -- see b.cond{" "}
          <span aria-hidden="true">{"→"}</span>
        </a>
      )}
    </section>
  );
}
