/**
 * The call card in plain words: what a printf or scanf call just did,
 * conversion by conversion. The machine sends numbers and the program's own
 * bytes (`call_card` in emulator/src/lib.rs): where each conversion sits in
 * the format, the register its argument came from, the value, the text it
 * printed or the address it stored to, and a code for what went wrong. A
 * stack address is named the way the pointer chips name it (`slotAt`).
 * Only the call card imports this, so no page ships it until a program
 * that calls printf or scanf is loaded.
 */

import type { Width } from "@/lib/asm/base-convert";
import type { FloatWidth } from "@/lib/asm/ieee754";
import { regionFor, type MemoryRegion } from "@/lib/emulator/memory-map";
import { floatText, integerReading } from "@/lib/emulator/register-format";
import { slotAt, type DrawnStack } from "@/lib/emulator/stack-frames";

/** `call_card`'s layout and codes (emulator/src/lib.rs, hosted/mod.rs). */
const HEADER = 11;
const ROW = 13;
const SCANF = 2;
const STOPPED = 1;
const NO_MATCH = 2;
const NO_INPUT = 3;
/** Sources: xN is N, dN is 32 + N, the stack is 64 + its 8-byte slot. */
const FP_SOURCE = 32;
const STACK_SOURCE = 64;
/** The first page: no program may use it, and the course server stops one
 *  that tries. */
const FIRST_PAGE = 4096;

export interface CallRow {
  /** What the conversion did, starting with the conversion as written. */
  text: string;
  /** What went wrong there, in a sentence, or null. */
  problem: string | null;
}

export interface CallCard {
  /** One per call, so a card is said once however often it is drawn. */
  event: string;
  /** "printf" or "scanf". */
  name: string;
  /** `scanf("%d %d")`: the call and its format as the source writes it. */
  title: string;
  /** "line 36", or null when the line map cannot name the call. */
  line: string | null;
  rows: CallRow[];
  /** What printf printed, or what scanf returned. */
  outcome: string;
}

export interface CallCardInput {
  /** The stack as drawn now, to name a slot; null when it cannot be drawn. */
  stack: DrawnStack | null;
  regions: readonly MemoryRegion[];
  lineLabel: (addr: number) => string | null;
}

const UTF8 = new TextDecoder();

/** A format or a printed text as a C string literal writes it. */
function literal(bytes: readonly number[], cut: boolean): string {
  const text = UTF8.decode(Uint8Array.from(bytes)).replace(/[\\"\x00-\x1f\x7f]/g, (c) => {
    const named: Record<string, string> = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\t": "\\t", "\r": "\\r" };
    return named[c] ?? `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
  return `"${text}${cut ? "…" : ""}"`;
}

function hex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

/** Where an argument came from, at `bytes` wide: "w1", "d0", or "sp + 8"
 *  once the registers ran out. */
function sourceName(source: number, bytes: number): string {
  if (source >= STACK_SOURCE) return `sp + ${(source - STACK_SOURCE) * 8}`;
  if (source >= FP_SOURCE) return `d${source - FP_SOURCE}`;
  return `${bytes === 8 ? "x" : "w"}${source}`;
}

/** "in w1", or "at sp + 8". */
function fromSource(source: number, bytes: number): string {
  return `${source >= STACK_SOURCE ? "at" : "in"} ${sourceName(source, bytes)}`;
}

const FLOATS = "feEgGaA";

/** The conversion's letter and how wide an integer it reads (`l`, `ll`, `z`,
 *  `j`, `t` make it 8 bytes; `%c` and plain ones 4). */
function letterOf(conv: string): { letter: string; wide: boolean } {
  return { letter: conv[conv.length - 1], wide: /[lzjt]/.test(conv) };
}

/** A number scanf stored, as its conversion reads it, in the register
 *  panel's number format. */
function numberText(letter: string, value: bigint, bytes: number): string {
  const width = (bytes * 8) as Width;
  if (letter === "x" || letter === "X") return hex(BigInt.asUintN(width, value));
  if (FLOATS.includes(letter)) return floatText(value, width as FloatWidth);
  const reading = integerReading(value, width);
  return letter === "u" ? (reading.unsigned ?? reading.signed) : reading.signed;
}

/** Where an address is, in the words the rest of the playground uses: a
 *  stack slot as the pointer chips name it, a label in .data or .bss, the
 *  heap or the stack by address; null when it is none of the program's
 *  variables. */
function placeOf(addr: bigint, label: string | null, input: CallCardInput): string | null {
  if (label) return label;
  const at = Number(addr);
  const slot = input.stack && slotAt(input.stack, at);
  if (slot) {
    const innermost = input.stack!.frames[input.stack!.frames.length - 1];
    return slot.index === innermost.index ? `${slot.slot} (${slot.offset})` : `${slot.slot} in ${slot.owner}'s frame`;
  }
  const region = addr <= BigInt(Number.MAX_SAFE_INTEGER) ? regionFor(at, input.regions)?.name : null;
  if (region === "stack") return `${hex(addr)} on the stack`;
  if (region === "heap") return `${hex(addr)} in the heap`;
  if (region === ".data" || region === ".bss") return `${hex(addr)} in ${region}`;
  return null;
}

/** The call card for `numbers`, null when there is no call to show. */
export function callCard(numbers: readonly number[], input: CallCardInput): CallCard | null {
  if (numbers.length < HEADER) return null;
  const [kind, step, callPc, result, failed, rowCount, conversions, fmtKept, fmtLen, textKept, textLen] = numbers;
  const body = HEADER + rowCount * ROW;
  const fmt = numbers.slice(body, body + fmtKept);
  const text = numbers.slice(body + fmtKept, body + fmtKept + textKept);
  let names = body + fmtKept + textKept;
  const piece = (bytes: readonly number[], from: number, to: number) => bytes.slice(Math.min(from, bytes.length), to);
  const name = kind === SCANF ? "scanf" : "printf";
  const rows: CallRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    const r = numbers.slice(HEADER + i * ROW, HEADER + (i + 1) * ROW);
    const [from, to, source, code, argLo, argHi, storedLo, storedHi, size, textFrom, textTo, labelLen, into] = r;
    const label = labelLen ? UTF8.decode(Uint8Array.from(numbers.slice(names, (names += labelLen)))) : null;
    const conv = UTF8.decode(Uint8Array.from(piece(fmt, from, to)));
    const arg = BigInt(argLo) | (BigInt(argHi) << 32n);
    const shown = piece(text, textFrom, textTo);
    const word = literal(shown, textTo > text.length);
    const labelled = label && (into ? `${label} + ${into}` : label);
    rows.push(
      kind === SCANF
        ? scanfRow(conv, { source, code, arg, stored: BigInt(storedLo) | (BigInt(storedHi) << 32n), size, word, label: labelled }, input)
        : printfRow(conv, { source, code, arg, word, printed: UTF8.decode(Uint8Array.from(shown)), label: labelled }, failed !== 0, input),
    );
  }
  if (conversions > rowCount) rows.push({ text: `and ${conversions - rowCount} more conversions`, problem: null });
  const outcome =
    kind === SCANF
      ? `returned ${result} in w0${result < 0 ? ": the input ended before anything was read" : ""}`
      : failed
        ? "stopped the program, so nothing was printed"
        : `printed ${literal(text, textLen > text.length)}`;
  return {
    event: `call ${step} ${callPc}`,
    name,
    title: `${name}(${literal(fmt, fmtLen > fmt.length)})`,
    line: input.lineLabel(callPc),
    rows,
    outcome,
  };
}

interface PrintfArg {
  source: number;
  code: number;
  arg: bigint;
  /** What the conversion printed, as a string literal, and as plain text. */
  word: string;
  printed: string;
  label: string | null;
}

/** A row of a printf that `stopped` the program says what printf read, since
 *  none of it was printed. */
function printfRow(conv: string, a: PrintfArg, stopped: boolean, input: CallCardInput): CallRow {
  const { letter, wide } = letterOf(conv);
  if (a.source < 0) return { text: `${conv} ${stopped ? "stands for" : "printed"} ${a.word}`, problem: null };
  const verb = stopped ? "read" : "printed";
  const pointer = letter === "s" || letter === "p";
  // printf reads a whole double for %f, and a whole address for %s and %p.
  const bytes = pointer || wide || FLOATS.includes(letter) ? 8 : 4;
  const from = fromSource(a.source, bytes);
  if (a.code === STOPPED) {
    return {
      text: `${conv} stopped printf: the value ${from} is ${hex(a.arg)}`,
      problem: letter === "s" ? `${hex(a.arg)} is not the address of a string, so printf had nothing to read.` : null,
    };
  }
  const stack =
    a.source >= STACK_SOURCE
      ? `${FLOATS.includes(letter) ? "d0 to d7" : "x1 to x7"} were all used, so printf read this value from the stack.`
      : null;
  if (letter === "s") {
    const place = placeOf(a.arg, a.label, input) ?? hex(a.arg);
    return { text: `${conv} ${verb} ${a.word} from ${place}, the address ${from}`, problem: stack };
  }
  // A number reads plainly; a character, spaces or nothing reads quoted.
  const shown = /^\S+$/.test(a.printed) && letter !== "c" ? a.printed : a.word;
  // Hex and characters say the number in decimal too.
  const also = "xXco".includes(letter) ? ` (${BigInt.asUintN(bytes * 8, a.arg)})` : "";
  return { text: `${conv} ${verb} ${shown}, the value ${from}${also}`, problem: stack };
}

interface ScanfArg {
  source: number;
  code: number;
  arg: bigint;
  stored: bigint;
  size: number;
  /** The input the conversion read, as a string literal. */
  word: string;
  label: string | null;
}

function scanfRow(conv: string, a: ScanfArg, input: CallCardInput): CallRow {
  const { letter } = letterOf(conv);
  if (a.code === NO_MATCH) return { text: `${conv} stored nothing: the input ${a.word} does not fit it, so scanf stopped there`, problem: null };
  if (a.code === NO_INPUT) return { text: `${conv} stored nothing: the input ended first`, problem: null };
  if (a.code === STOPPED) return { text: `scanf stopped at ${conv}`, problem: null };
  if (a.source < 0) return { text: `${conv} read ${a.word}`, problem: null };
  const value = letter === "s" || letter === "c" ? a.word : numberText(letter, a.stored, a.size);
  const from = fromSource(a.source, 8);
  const place = placeOf(a.arg, a.label, input);
  if (place) return { text: `${conv} stored ${value} at ${place}, the address ${from}`, problem: null };
  const reg = sourceName(a.source, 8);
  return {
    text: `${conv} stored ${value} at ${hex(a.arg)}, which is not one of your variables`,
    problem:
      `${reg} should hold the address of a variable (add ${reg}, fp, its offset for a local, or ldr ${reg}, =its label), not its value.` +
      (a.arg < BigInt(FIRST_PAGE) ? " On the course server this stops the program." : ""),
  };
}

/** The card as a screen reader says it, once. */
export function spokenCard(card: CallCard): string {
  const rows = card.rows.map((row) => (row.problem ? `${row.text}. ${row.problem}` : `${row.text}.`));
  return [`${card.title}${card.line ? ` on ${card.line}` : ""} ${card.outcome}.`, ...rows].join(" ");
}
