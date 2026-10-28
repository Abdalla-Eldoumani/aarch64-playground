/**
 * The call stack's events in plain words: a write over a caller's saved fp
 * or lr, a `ret` that went to no caller, and a caller reading x19 to x28
 * after a call left one changed. Each card names the line and, for a write,
 * the step, counted as the step counter counts them. The machine sends
 * numbers (frames.rs, the clobber note rows); only the frames view, a goal
 * run's stop and a fault import this, so no page ships it until one does.
 */

import { at, type Place } from "@/lib/emulator/clobber-note";
import type { FrameLayoutPayload } from "@/lib/emulator/frame-data";
import {
  decodeFrameLayout,
  decodeFrames,
  LR_UNSAVED,
  RUNTIME_CALL,
  type FrameLayout,
  type FrameRow,
  type FramesSnapshot,
} from "@/lib/emulator/stack-frames";

/** Where the program's instructions are written, as the hub knows it. */
export interface ProgramLines {
  /** The line holding the instruction at `addr`, null outside the program. */
  linePlace: (addr: number) => Place | null;
  /** The first instruction on a line the machine reported, null for none. */
  lineAddr: (line: number) => number | null;
}

export interface CardContext extends ProgramLines {
  snapshot: FramesSnapshot;
  layout: FrameLayout | null;
}

/** A card and the event it tells of (a slot at a step, a function's ret
 *  line, a read), so the frames view says each event once, whatever its
 *  words: a loop of rets from one line is one event. */
export interface Card {
  event: string;
  text: string;
}

/** What sent a ret astray: a store over the saved lr, or a call made
 *  before lr was saved whose return address the ret went to. */
export type ReturnCause = "overwritten" | "unsaved";

/** The bad return's card; the explainer picks its fix from `cause`, null
 *  when the frame shows none. */
export interface ReturnCard extends Card {
  cause: ReturnCause | null;
}

/** The context from the hub's raw numbers, null on a wasm build without them. */
export function cardContext(
  frames: readonly number[] | null,
  layout: FrameLayoutPayload | null,
  lines: ProgramLines,
): CardContext | null {
  const snapshot = frames ? decodeFrames(frames) : null;
  return snapshot && { ...lines, snapshot, layout: layout && decodeFrameLayout(layout) };
}

const hex = (value: number | bigint) => `0x${value.toString(16)}`;

/** The instruction as written on its line, past labels and the comment. */
function code(p: Place): string {
  return p.text
    .replace(/\/\/.*$/, "")
    .replace(/^\s*(?:[A-Za-z_.$][\w.$]*:\s*)*/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function words(ctx: ProgramLines & { layout: FrameLayout | null }) {
  const fnAt = (addr: number) => ctx.layout?.functions.find((f) => f.entry <= addr && addr < f.end);
  const fnName = (addr: number) => fnAt(addr)?.name ?? "a function";
  /** "line 32 in helper (`str w10, [x9, w10, sxtw 2]`)"; `code` only when asked. */
  const line = (addr: number, withCode = false) => {
    const p = ctx.linePlace(addr);
    if (!p) return null;
    const text = withCode ? code(p) : "";
    return `${at(p)} in ${fnName(addr)}${text && ` (\`${text}\`)`}`;
  };
  return { fnAt, fnName, line };
}

/** "Line 32 in helper" to start a sentence; "ui.s line 3" keeps its file name as written. */
const capital = (s: string) => (s.startsWith("line ") ? `L${s.slice(1)}` : s);

/** Where a call's saved lr should send it: "the C runtime", "main at line 17". */
function backTo(row: FrameRow, ctx: ProgramLines, fnName: (addr: number) => string): string {
  if (row.flags & RUNTIME_CALL) return "qsort or bsearch";
  const p = row.index === 0 ? null : ctx.linePlace(row.retAddr);
  return p ? `${fnName(row.retAddr)} at ${at(p)}` : "the C runtime";
}

/** The callers' saved fp and lr slots the last step overwrote, each with the
 *  address of the word its card quotes. */
export function writtenSlots(snapshot: FramesSnapshot) {
  return snapshot.frames.flatMap((row) =>
    (["fp", "lr"] as const).flatMap((slot) => {
      const hit = slot === "fp" ? row.fpHit : row.lrHit;
      if (row.record === 0 || !hit || hit.step !== snapshot.step) return [];
      return [{ row, slot, hit, addr: slot === "fp" ? row.record : row.record + 8 }];
    }),
  );
}

/**
 * One card per caller's saved fp or lr the last step overwrote: "Line 32 in
 * helper (`str w10, [x9, w10, sxtw 2]`) wrote arr_s[6] over main's saved lr.
 * It now holds 0x6; it should send main back to the C runtime." None for a
 * slot whose word `readWord` does not know yet.
 */
export function writeCards(ctx: CardContext, readWord: (addr: number) => bigint | null): Card[] {
  const { snapshot, layout } = ctx;
  const { fnName, line } = words(ctx);
  const owner = (row: FrameRow) => fnName(row.entry);
  const cards: Card[] = [];
  for (const { row, slot, hit, addr } of writtenSlots(snapshot)) {
    const now = readWord(addr);
    if (now == null) continue;
    const name = owner(row);
    const writer = line(hit.pc, true);
    const element =
      hit.element == null ? "" : `${(hit.arrayName != null && layout?.names[hit.arrayName]) || "an array"}[${hit.element}] `;
    let should: string;
    if (slot === "lr") should = `send ${name} back to ${backTo(row, ctx, fnName)}`;
    else if (row.fpEntry === 0) should = `hold 0, since ${name} has no caller frame`;
    else {
      const caller = snapshot.frames.find((r) => r.record === row.fpEntry);
      should = `point at ${caller ? owner(caller) : "its caller"}'s frame (${hex(row.fpEntry)})`;
    }
    cards.push({
      event: `${slot} at ${hex(addr)}, step ${hit.step}`,
      text:
        `${writer ? capital(writer) : "A store"} wrote ${element}over ${name}'s saved ${slot}.` +
        ` It now holds ${hex(now)}; it should ${should}.`,
    });
  }
  return cards;
}

/**
 * The `ret` that went to no caller, and why when the frame shows it: "main's
 * ret on line 21 jumped to 0x700000006 instead of going back to the C
 * runtime, because line 32 in helper overwrote the saved lr in main's frame
 * at step 45." `lr` is x30 as the registers hold it: the target the machine
 * sends is an f64, which loses the low bits of a target above 2^53.
 */
export function returnCard(ctx: CardContext, lr: bigint | null): ReturnCard | null {
  const bad = ctx.snapshot.badReturn;
  const row = ctx.snapshot.frames.at(-1);
  if (!bad || !row) return null;
  const { fnAt, fnName, line } = words(ctx);
  const name = fnName(row.entry);
  const ret = ctx.linePlace(bad.pc);
  const landed = ctx.linePlace(bad.target);
  const went =
    landed && fnAt(bad.target)?.entry === row.entry
      ? `went back into ${name}`
      : landed
        ? `went to ${line(bad.target)}`
        : `jumped to ${hex(lr != null && Number(lr) === bad.target ? lr : bad.target)}`;
  let cause: ReturnCause | null = null;
  let because = "";
  if (row.lrHit) {
    cause = "overwritten";
    because = `, because ${line(row.lrHit.pc) ?? "a store"} overwrote the saved lr in ${name}'s frame at step ${row.lrHit.step}`;
  } else if (row.flags & LR_UNSAVED && bad.target === row.lastRet) {
    // It called out before storing lr, and the ret landed right after its
    // own last call, so lr still held that call's return address. A
    // function that did store lr lands there too when it loads lr back from
    // a callee's old slot, so the store counts, not the frame's shape.
    cause = "unsaved";
    const call = ctx.linePlace(bad.target - 4);
    const bl = call && /^bl\b/i.test(code(call)) ? ` with \`${code(call)}\` on ${at(call)}` : "";
    because = `, because ${name} called out${bl} before saving lr, so lr still held that call's return address`;
  }
  return {
    event: `ret at ${hex(bad.pc)} in ${hex(row.entry)}`,
    text: `${name}'s ret on ${ret ? at(ret) : "its last line"} ${went} instead of going back to ${backTo(row, ctx, fnName)}${because}.`,
    cause,
  };
}

/**
 * A fault or the step ceiling, reworded when the frame shows why a ret went
 * astray: a fault at the address the `ret` went to keeps its first sentence
 * and takes the card in place of the crate's guess about the base register;
 * the step ceiling, and a run paused after its million steps, keep their
 * message and take the card under it. The card comes back too, for the
 * console and the explainer. Null when the frame shows no cause: then the
 * crate's message stands as it is.
 */
export function faultText(
  message: string,
  ctx: CardContext,
  lr: bigint | null,
  pc: bigint,
): { error: string; card: ReturnCard } | null {
  const card = returnCard(ctx, lr);
  const bad = ctx.snapshot.badReturn;
  if (!card?.cause || !bad) return null;
  // The crate's ceiling, or a run paused after its million steps.
  if (/the playground's ceiling|without finishing/.test(message)) return { error: `${message}\n${card.text}`, card };
  if (Number(pc) !== bad.target) return null;
  const end = message.indexOf(". ");
  return { error: `${end < 0 ? message : message.slice(0, end + 1)} ${card.text}`, card };
}

/**
 * A caller reading x19 to x28 after a call it made left one changed, from
 * the clobber note rows (`[register, readBy, retLine, readLine]`, lines as
 * the machine numbers them); rows for other registers are clobber-note.ts's.
 */
export function calleeCards(
  rows: readonly number[],
  lines: ProgramLines,
  layout: FrameLayoutPayload | null,
): Card[] {
  const ctx = { ...lines, layout: layout && decodeFrameLayout(layout) };
  const { fnName, line } = words(ctx);
  const cards: Card[] = [];
  for (let i = 0; i + 3 < rows.length; i += 4) {
    const [reg, , retLine, readLine] = rows.slice(i, i + 4);
    if (reg < 19 || reg > 28) continue;
    const ret = retLine > 0 ? ctx.lineAddr(retLine) : null;
    const read = readLine > 0 ? ctx.lineAddr(readLine) : null;
    const reader = read == null ? null : line(read);
    const retPlace = ret == null ? null : ctx.linePlace(ret);
    const callee = ret == null ? "a function it called" : fnName(ret);
    cards.push({
      event: `x${reg} read on line ${readLine}`,
      text:
        `${reader ? capital(reader) : "The program"} reads x${reg}, but ${callee} changed it and ` +
        `${retPlace ? `its ret on ${at(retPlace)}` : "its ret"} did not put it back. x19 to x28 are ` +
        "callee-saved: a function that uses one must save it first and put it back before it " +
        `returns. Do scratch work in x9 to x15, or save x${reg} on the stack and restore it before ret.`,
    });
  }
  return cards;
}
