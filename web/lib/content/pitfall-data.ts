/**
 * The common mistakes on /reference: each one a card with a broken program
 * and its fix, plus what the course server (csarm) printed for both. The
 * cards live in lib/content/pitfalls/, one file per group; this module joins
 * them in group order. pitfall-data.playground.test.ts runs every program and
 * holds the playground to the server's result, and pitfall-data.test.ts checks
 * that every link resolves.
 */

import { REGISTER_PITFALLS } from "@/lib/content/pitfalls/registers";
import { FLAG_PITFALLS } from "@/lib/content/pitfalls/flags";
import { MEMORY_PITFALLS } from "@/lib/content/pitfalls/memory";
import { STACK_PITFALLS } from "@/lib/content/pitfalls/stack";
import { DATA_PITFALLS } from "@/lib/content/pitfalls/data";
import { ARITHMETIC_PITFALLS } from "@/lib/content/pitfalls/arithmetic";
import { FLOATING_POINT_PITFALLS } from "@/lib/content/pitfalls/floating-point";
import { IO_PITFALLS } from "@/lib/content/pitfalls/io";
import { referenceId } from "@/lib/content/site";

export type PitfallGroup =
  | "registers"
  | "flags"
  | "memory"
  | "stack"
  | "data"
  | "arithmetic"
  | "floating-point"
  | "io";

/**
 * The groups in the order the catalog shows them: the heading over each
 * group, and the short name on its filter button, so the eight buttons fit
 * in three rows on a phone.
 */
export const PITFALL_GROUPS: { id: PitfallGroup; label: string; short: string }[] = [
  { id: "registers", label: "Registers and values", short: "Registers" },
  { id: "flags", label: "Flags and branches", short: "Flags" },
  { id: "memory", label: "Memory and addressing", short: "Memory" },
  { id: "stack", label: "The stack and calls", short: "Stack" },
  { id: "data", label: "Data and directives", short: "Data" },
  { id: "arithmetic", label: "Integer arithmetic", short: "Arithmetic" },
  { id: "floating-point", label: "Floating point", short: "Floating point" },
  { id: "io", label: "Input and output", short: "printf" },
];

/** The reference entry a card names when no single instruction fits. */
export const CALLING_CONVENTION = "calling convention";

/**
 * How a run ended on csarm: an exit status, a signal, still running when the
 * capture stopped it after 10 seconds, or a build that failed (the first
 * error line from as or ld, without its file and line prefix).
 */
export type ServerEnd =
  | { exit: number }
  | { signal: "SIGSEGV" | "SIGBUS" }
  | { timeout: true }
  | { buildError: string };

export interface PitfallRun {
  /** A complete program, m4 defines included. */
  source: string;
  /** What csarm printed to stdout, byte for byte. */
  stdout: string;
  ends: ServerEnd;
}

export interface Pitfall {
  /** The card's id on /reference: `#pitfall-<slug>`. */
  slug: string;
  title: string;
  group: PitfallGroup;
  /** The rule that was broken, rendered through LessonMarkdown. */
  mistake: string;
  /** What csarm does with the broken program, finishing "The broken program ...". */
  server: string;
  /** What the playground does with it, finishing "It ...". */
  playground: string;
  /** How to fix it, rendered through LessonMarkdown. */
  fix: string;
  /** Short wrong-side snippet for the card. */
  wrong: string;
  /** Short right-side snippet for the card. */
  right: string;
  broken: PitfallRun;
  fixed: PitfallRun;
  /** Where the rule is written down: the Arm ARM, the GNU as manual, or AAPCS64. */
  source: { title: string; href: string };
  /** The slug of the lesson that teaches the rule. */
  lesson: string;
  /** The reference entry: an instruction's mnemonic, or CALLING_CONVENTION. */
  reference: string;
}

/** Where a card's reference link goes on /reference. */
export function referenceHref(reference: string): string {
  return reference === CALLING_CONVENTION
    ? "/reference#calling-convention"
    : `/reference#${referenceId(reference)}`;
}

export const PITFALLS: Pitfall[] = [
  ...REGISTER_PITFALLS,
  ...FLAG_PITFALLS,
  ...MEMORY_PITFALLS,
  ...STACK_PITFALLS,
  ...DATA_PITFALLS,
  ...ARITHMETIC_PITFALLS,
  ...FLOATING_POINT_PITFALLS,
  ...IO_PITFALLS,
];
