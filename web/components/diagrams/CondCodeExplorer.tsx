"use client";

/**
 * The condition-code explorer for the b.cond reference entry. Ten chips --
 * the course's condition codes grouped either-sign / signed / unsigned -- and
 * a detail card that answers, for the picked code: the question it asks after
 * `cmp a, b`, the exact flag formula, why that formula answers the question,
 * and the C reading. Below, a live compare: the student types the two
 * operands and the panel shows the four flags with the ones this code ignores
 * dimmed, then the taken / falls-through verdict. Picking a code and typing
 * operands is the user acting (cyan); the computed flags and the verdict are
 * the machine acting (amber). The flag math is computeIntFlags from
 * lib/emulator/flag-math -- the same NZCV rules the executor applies -- and
 * operands are fixed at the 32-bit w registers; the width story lives in the
 * FlagEffect panel on the flag-setting entries. Token-only, keyboard
 * accessible (native buttons and inputs), reduced-motion safe (discrete state
 * swaps, no animation).
 */

import { useId, useState, type JSX } from "react";
import { Input } from "@/components/ui/Input";
import {
  computeIntFlags,
  parseIntOperand,
  type Flags,
} from "@/lib/emulator/flag-math";

type CondGroup = "either sign" | "signed" | "unsigned";

export interface CondCode {
  /** The suffix the student writes: b.eq, b.lt, ... */
  code: string;
  group: CondGroup;
  /** The plain-language question the code asks after `cmp a, b`. */
  question: string;
  /** The exact flag formula, spelled the way the course reads it. */
  formula: string;
  /** Why the flag math answers the question. */
  why: string;
  /** The C reading of the same test. */
  c: string;
  /** The paired code in the other reading (signed vs unsigned), if any. */
  counterpart?: string;
  /** The flags the formula actually reads; the rest render dimmed. */
  reads: Array<keyof Flags>;
  taken: (f: Flags) => boolean;
  /** Default operands chosen to land on the code's teaching point. */
  defaults: [string, string];
}

/** The ten condition codes the course teaches, in index order. */
export const COND_CODES: CondCode[] = [
  {
    code: "eq",
    group: "either sign",
    question: "did the compare find the two values equal?",
    formula: "z = 1",
    why: "a - b cancels to exactly zero only when the sides match, and a zero result sets z. eq reads the same whichever way the bits are meant.",
    c: "if (a == b)",
    reads: ["z"],
    taken: (f) => f.z,
    defaults: ["7", "7"],
  },
  {
    code: "ne",
    group: "either sign",
    question: "did the compare find the two values different?",
    formula: "z = 0",
    why: "any nonzero difference leaves z clear; ne is eq inverted, so after one compare exactly one of the two is taken.",
    c: "if (a != b)",
    reads: ["z"],
    taken: (f) => !f.z,
    defaults: ["7", "9"],
  },
  {
    code: "lt",
    group: "signed",
    question: "is the left value below the right, reading both as signed?",
    formula: "n ≠ v",
    why: "a - b comes out negative (n set) when the left is smaller, unless the subtraction overflowed and flipped the sign, which v records. n disagreeing with v means genuinely below.",
    c: "if (a < b)",
    counterpart: "b.lo asks the same question in the unsigned reading; after the same cmp the two can disagree.",
    reads: ["n", "v"],
    taken: (f) => f.n !== f.v,
    defaults: ["-1", "1"],
  },
  {
    code: "le",
    group: "signed",
    question: "is the left value below or equal to the right, signed?",
    formula: "z = 1 or n ≠ v",
    why: "le is lt with equality allowed: either the subtraction cancelled to zero, or it came out genuinely negative.",
    c: "if (a <= b)",
    counterpart: "b.ls asks the same question in the unsigned reading.",
    reads: ["z", "n", "v"],
    taken: (f) => f.z || f.n !== f.v,
    defaults: ["5", "5"],
  },
  {
    code: "gt",
    group: "signed",
    question: "is the left value above the right, signed?",
    formula: "z = 0 and n = v",
    why: "gt refuses both halves of le: the values are not equal, and the sign of a - b, corrected for overflow, says not-below.",
    c: "if (a > b)",
    counterpart: "b.hi asks the same question in the unsigned reading.",
    reads: ["z", "n", "v"],
    taken: (f) => !f.z && f.n === f.v,
    defaults: ["9", "3"],
  },
  {
    code: "ge",
    group: "signed",
    question: "is the left value above or equal to the right, signed?",
    formula: "n = v",
    why: "ge is lt inverted: when the sign of a - b agrees with the overflow flag, the subtraction did not land below zero.",
    c: "if (a >= b)",
    counterpart: "b.hs asks the same question in the unsigned reading.",
    reads: ["n", "v"],
    taken: (f) => f.n === f.v,
    defaults: ["3", "3"],
  },
  {
    code: "lo",
    group: "unsigned",
    question: "is the left value below the right, reading both as unsigned?",
    formula: "c = 0",
    why: "an unsigned subtraction that needs a borrow clears c, and needing a borrow is exactly what below means. lo is also spelled cc (carry clear).",
    c: "if (a < b)",
    counterpart: "b.lt asks the same question in the signed reading; with the defaults here lt fires and lo does not, because the bits of -1 read as the largest unsigned value.",
    reads: ["c"],
    taken: (f) => !f.c,
    defaults: ["-1", "1"],
  },
  {
    code: "ls",
    group: "unsigned",
    question: "is the left value below or equal to the right, unsigned?",
    formula: "c = 0 or z = 1",
    why: "either the borrow says below, or z says equal.",
    c: "if (a <= b)",
    counterpart: "b.le asks the same question in the signed reading.",
    reads: ["c", "z"],
    taken: (f) => !f.c || f.z,
    defaults: ["3", "7"],
  },
  {
    code: "hi",
    group: "unsigned",
    question: "is the left value above the right, unsigned?",
    formula: "c = 1 and z = 0",
    why: "no borrow and not equal: the left side is strictly above in the unsigned reading.",
    c: "if (a > b)",
    counterpart: "b.gt asks the same question in the signed reading.",
    reads: ["c", "z"],
    taken: (f) => f.c && !f.z,
    defaults: ["0xff", "0x0f"],
  },
  {
    code: "hs",
    group: "unsigned",
    question: "is the left value above or equal to the right, unsigned?",
    formula: "c = 1",
    why: "no borrow at all means the left side covered the right. hs is also spelled cs (carry set).",
    c: "if (a >= b)",
    counterpart: "b.ge asks the same question in the signed reading.",
    reads: ["c", "z"],
    taken: (f) => f.c,
    defaults: ["2", "2"],
  },
];

const GROUPS: CondGroup[] = ["either sign", "signed", "unsigned"];

const PANEL_LABEL =
  "[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]";
const CHIP_BASE =
  "min-h-[44px] rounded-[var(--radius-control)] border px-3 font-mono text-[13px] outline-none transition-colors focus-visible:[box-shadow:var(--ring)]";
const CHIP_ON =
  "border-[var(--cyan)] bg-[color-mix(in_srgb,var(--cyan)_12%,transparent)] text-[var(--text-primary)]";
const CHIP_OFF =
  "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
const FORMULA_CHIP =
  "self-start rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-1.5 font-mono text-[13px] text-[var(--text-primary)]";

/** Amber = the machine acting: a lit flag or the taken verdict. */
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

export function CondCodeExplorer({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  const [code, setCode] = useState("eq");
  const picked = COND_CODES.find((c) => c.code === code) ?? COND_CODES[0];
  // Operand text keyed by code, so switching codes presents each one's
  // teaching-point defaults until the student edits them.
  const [edits, setEdits] = useState<Record<string, [string, string]>>({});
  const [aText, bText] = edits[picked.code] ?? picked.defaults;
  const aId = useId();
  const bId = useId();

  function setOperand(index: 0 | 1, value: string) {
    setEdits((prev) => {
      const [a, b] = prev[picked.code] ?? picked.defaults;
      const pair: [string, string] = index === 0 ? [value, b] : [a, value];
      return { ...prev, [picked.code]: pair };
    });
  }

  // Plain recompute per render: two parses and one 32-bit subtract. The
  // React Compiler memoizes it; a useMemo here defeated that instead.
  const parsedA = parseIntOperand(aText);
  const parsedB = parseIntOperand(bText);
  const outcome =
    parsedA === null || parsedB === null
      ? null
      : computeIntFlags("sub", parsedA, parsedB, 32);

  const taken = outcome !== null && picked.taken(outcome.flags);

  return (
    <section
      aria-label="b.cond condition codes"
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <p className={PANEL_LABEL}>what each condition asks</p>
        <p className="font-mono text-[15px] text-[var(--text-primary)]">
          cmp w9, w10 {"->"} b.{picked.code} label
        </p>
        <p className="[font:var(--type-small)] text-[var(--text-secondary)]">
          after a compare, every condition code is a question about the four
          flags it left behind. eq and ne read the same either way; the other
          eight come in signed / unsigned pairs; pick by how the program
          means the bits, not by what looks familiar.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        {GROUPS.map((group) => (
          <div key={group} className="flex flex-wrap items-center gap-2">
            <span className={`${PANEL_LABEL} min-w-[6rem]`}>{group}</span>
            <div
              role="group"
              aria-label={`${group} condition codes`}
              className="flex flex-wrap gap-2"
            >
              {COND_CODES.filter((c) => c.group === group).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  aria-pressed={c.code === picked.code}
                  onClick={() => setCode(c.code)}
                  className={`${CHIP_BASE} ${
                    c.code === picked.code ? CHIP_ON : CHIP_OFF
                  }`}
                >
                  b.{c.code}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-l-2 border-[var(--cyan)] pl-3">
        <p className="[font:var(--type-body)] text-[var(--text-primary)]">
          {picked.question}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={FORMULA_CHIP}>taken when {picked.formula}</span>
          <span className={FORMULA_CHIP}>
            {picked.c}{" "}
            <span className="text-[var(--text-tertiary)]">
              {"//"} {picked.group === "either sign" ? "either" : picked.group}
            </span>
          </span>
        </div>
        <p className="[font:var(--type-small)] text-[var(--text-secondary)]">
          {picked.why}
        </p>
        {picked.counterpart && (
          <p className="[font:var(--type-small)] text-[var(--text-tertiary)]">
            {picked.counterpart}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1">
          <label htmlFor={aId} className={PANEL_LABEL}>
            w9
          </label>
          <Input
            id={aId}
            mono
            value={aText}
            onChange={(event) => setOperand(0, event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1">
          <label htmlFor={bId} className={PANEL_LABEL}>
            w10
          </label>
          <Input
            id={bId}
            mono
            value={bText}
            onChange={(event) => setOperand(1, event.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {outcome === null ? (
        <p className="[font:var(--type-small)] text-[var(--text-secondary)]">
          enter a number, decimal or 0x hex, negative welcome.
        </p>
      ) : (
        <>
          <ul aria-label="flags after the compare" className="flex flex-wrap gap-2">
            {(Object.keys(FLAG_WORDS) as Array<keyof Flags>).map((flag) => {
              const lit = outcome.flags[flag];
              const read = picked.reads.includes(flag);
              return (
                <li
                  key={flag}
                  aria-label={`${flag.toUpperCase()} ${FLAG_WORDS[flag]}: ${
                    lit ? 1 : 0
                  }, ${read ? "read by" : "ignored by"} b.${picked.code}`}
                  className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2 ${
                    read ? "" : "opacity-50"
                  }`}
                  style={lit && read ? LIT_STYLE : undefined}
                >
                  <span className="font-mono text-[15px] font-semibold text-[var(--text-primary)]">
                    {flag.toUpperCase()} = {lit ? 1 : 0}
                  </span>
                  <span className="[font:var(--type-label)] text-[var(--text-secondary)]">
                    {read ? FLAG_WORDS[flag] : "ignored"}
                  </span>
                </li>
              );
            })}
          </ul>

          <p
            aria-label={`b.${picked.code}: ${taken ? "taken" : "not taken"}`}
            className="self-start rounded-[var(--radius-control)] border px-3 py-2 font-mono text-[13px] text-[var(--text-primary)]"
            style={taken ? LIT_STYLE : { borderColor: "var(--border)" }}
          >
            <span aria-hidden="true">{taken ? "●" : "○"}</span>{" "}
            b.{picked.code} label {"->"}{" "}
            {taken
              ? "taken: the pc jumps to label"
              : "not taken: execution falls through to the next instruction"}
          </p>
        </>
      )}

      <p className="[font:var(--type-small)] text-[var(--text-tertiary)]">
        eq and ne also answer after adds, subs, ands, and tst: any
        instruction that sets the flags, not just cmp.
      </p>
    </section>
  );
}
