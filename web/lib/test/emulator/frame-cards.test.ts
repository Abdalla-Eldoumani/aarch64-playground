// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { explainError } from "@/lib/asm/error-explain";
import {
  calleeCards,
  cardContext,
  faultText,
  returnCard,
  writeCards,
  type Card,
  type CardContext,
  type ProgramLines,
} from "@/lib/emulator/frame-cards";
import { calleeLeftovers } from "@/lib/emulator/frame-data";

// The cards on real machine states from the node build. Every line and step
// in the expected words is counted by hand from the fixture's text in the
// comments, never read back from the code under test.
const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures", name), "utf8").replace(/\r\n/g, "\n");

interface Loaded {
  emu: Machine;
  lines: ProgramLines;
  /** The cards' view of the machine as it stands. */
  context: () => CardContext;
  lr: () => bigint;
  pc: () => bigint;
  word: (addr: number) => bigint;
  step: (n: number) => void;
  /** Run to the end in the chunks the site runs in. */
  run: () => { error?: string | null; steps: number };
}

function load(source: string, stdin?: string): Loaded {
  const emu = new Emulator();
  const loaded = emu.assemble_and_load(source) as { success: boolean; error?: string | null };
  expect(loaded.error ?? null).toBeNull();
  if (stdin) emu.push_stdin(stdin);
  const map = Array.from(emu.get_line_map());
  const text = source.split("\n");
  const lines: ProgramLines = {
    linePlace: (addr) => {
      for (let i = 0; i + 1 < map.length; i += 2) {
        if (map[i] === addr) return { file: null, line: map[i + 1], text: text[map[i + 1] - 1] };
      }
      return null;
    },
    lineAddr: (line) => {
      for (let i = 0; i + 1 < map.length; i += 2) if (map[i + 1] === line) return map[i];
      return null;
    },
  };
  const layout = { numbers: Array.from(emu.frame_layout()), names: emu.frame_names() };
  return {
    emu,
    lines,
    context: () => cardContext(Array.from(emu.frames()), layout, lines)!,
    lr: () => BigInt(emu.get_register(30)),
    pc: () => BigInt(emu.get_pc()),
    word: (addr) => {
      const bytes = emu.get_memory_range(addr, 8);
      let value = 0n;
      for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]);
      return value;
    },
    step: (n) => {
      for (let i = 0; i < n; i++) emu.step();
    },
    run: () => {
      let steps = 0;
      let error: string | null | undefined;
      while (!emu.is_halted() && !emu.is_blocked()) {
        const r = emu.run_until_break(1_000_000) as { steps_executed: number; error?: string | null };
        steps += r.steps_executed;
        error = r.error;
      }
      return { error, steps };
    },
  };
}

/** The layout as the hub keeps it, for calleeCards. */
const layoutOf = (emu: Machine) => ({ numbers: Array.from(emu.frame_layout()), names: emu.frame_names() });

const texts = (cards: Card[]) => cards.map((card) => card.text);

// array-overrun.s: main is lines 14 to 21, helper 26 to 36, the store on 32.
// Steps: main's stp, mov and bl helper are 1 to 3; helper's stp, mov, add
// and mov 4 to 7; each pass of the loop is cmp, b.ge, str, add, b, so arr[i]
// is stored at step 10 + 5i: arr[4] at 30, arr[5] at 35, arr[6] at 40 and
// arr[7] at 45. arr_s is fp + 16 in helper's 32-byte frame, so arr[4] and
// arr[5] are main's saved fp and arr[6] and arr[7] its saved lr. At i = 8 the
// cmp and b.ge are 48 and 49, helper's ldp and ret 50 and 51, main's ldr, bl
// printf, two trampoline words and printf 52 to 56, mov 57, ldp 58, and
// main's ret 59 takes lr = 7 << 32 | 6. Step 60 fetches there and faults.
const OVERRUN = fixture("array-overrun.s");
const STORE = "Line 32 in helper (`str w10, [x9, w10, sxtw 2]`)";
const BAD_RETURN =
  "main's ret on line 21 jumped to 0x700000006 instead of going back to the C runtime, " +
  "because line 32 in helper overwrote the saved lr in main's frame at step 45.";

describe("a write over a caller's saved fp or lr", () => {
  it("is worded at the step that made it, and only then", () => {
    const m = load(OVERRUN);
    m.step(30);
    expect(texts(writeCards(m.context(), m.word))).toEqual([
      `${STORE} wrote arr_s[4] over main's saved fp. It now holds 0x4; it should hold 0, since main has no caller frame.`,
    ]);
    m.step(1);
    expect(writeCards(m.context(), m.word)).toEqual([]);
    m.step(4);
    expect(texts(writeCards(m.context(), m.word))).toEqual([
      `${STORE} wrote arr_s[5] over main's saved fp. It now holds 0x500000004; it should hold 0, since main has no caller frame.`,
    ]);
    m.step(5);
    expect(texts(writeCards(m.context(), m.word))).toEqual([
      `${STORE} wrote arr_s[6] over main's saved lr. It now holds 0x6; it should send main back to the C runtime.`,
    ]);
    m.step(5);
    expect(texts(writeCards(m.context(), m.word))).toEqual([
      `${STORE} wrote arr_s[7] over main's saved lr. It now holds 0x700000006; it should send main back to the C runtime.`,
    ]);
    // Back and forward again: the step it names is the one the counter shows.
    m.emu.step_back();
    m.step(1);
    expect(writeCards(m.context(), m.word)[0].text).toContain("arr_s[7]");
    m.emu.free();
  });

  // The stack starts at 0x80000000 and main's frame is 32 bytes, so its
  // record is at 0x7fffffe0 and its saved lr 8 bytes above.
  it("waits for the slot's word, and tells the slot and the step", () => {
    const m = load(OVERRUN);
    m.step(40);
    expect(writeCards(m.context(), () => null)).toEqual([]);
    expect(writeCards(m.context(), m.word).map((card) => card.event)).toEqual(["lr at 0x7fffffe8, step 40"]);
    m.emu.free();
  });
});

describe("a ret through an overwritten lr", () => {
  it("is explained from the bad return on, naming the store and its step", () => {
    const m = load(OVERRUN);
    m.step(58);
    expect(returnCard(m.context(), m.lr())).toBeNull();
    m.step(1);
    expect(returnCard(m.context(), m.lr())).toEqual({ event: "ret at step 59", text: BAD_RETURN, cause: "overwritten" });
    m.emu.free();
  });

  // The crate's words stay as they are; the web keeps their first sentence
  // and puts the card where they guess at a base register.
  it("takes the place of the fault's guess in the run row and in the explainer", () => {
    const m = load(OVERRUN);
    const { error, steps } = m.run();
    expect(steps).toBe(60);
    expect(error).toBe(
      "memory fault: the program tried to read 0x0000000700000006, which no section covers. The base " +
        "register (the first one inside the brackets, or a pointer passed to a call) does not hold an " +
        "address, usually because `ldr xN, label` lost its `=` (it loads the value stored at the label) " +
        "or a `mov` was written where `ldr xN, =label` was meant",
    );
    const said = faultText(error!, m.context(), m.lr(), m.pc());
    expect(said).toEqual({
      error: `memory fault: the program tried to read 0x0000000700000006, which no section covers. ${BAD_RETURN}`,
      card: { event: "ret at step 59", text: BAD_RETURN, cause: "overwritten" },
    });
    const explained = explainError(said!.error, said!.card)!;
    expect(explained.why).toBe(BAD_RETURN);
    expect(explained.fix).not.toContain("=");
    // A fault with no bad return behind it keeps the old explanation.
    expect(explainError(error!)!.why).toContain("`ldr xN, label` written without its `=`");
    m.emu.free();
  });

  // fill_words stores words[i] at step 12 + 4i (main's stp, mov, bl; its own
  // stp, mov, add, ldr, mov, b; then cmp, b.lt): words[3], main's saved lr,
  // at step 24. main's ret is line 34; the store line 19. x30 still holds the
  // eight 'A's, which an f64 cannot.
  it("names a target past 2^53 exactly", () => {
    const m = load(`// fill_words writes four longs into a two-long array.
define(fp, x29)
define(lr, x30)
words_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc
.text
// fill_words(): words[i] = "AAAAAAAA" for i = 0 to 3 (bug: words holds 2)
        .balign 4
        .global fill_words
fill_words:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x9, fp, words_s         // x9 = &words[0]
        ldr     x11, =0x4141414141414141
        mov     w10, 0
        b       fw_test
fw_loop:
        str     x11, [x9, w10, sxtw 3]  // words[i] = "AAAAAAAA"
        add     w10, w10, 1
fw_test:
        cmp     w10, 4
        b.lt    fw_loop
        ldp     fp, lr, [sp], dealloc
        ret
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      fill_words
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`);
    const { error } = m.run();
    const card =
      "main's ret on line 34 jumped to 0x4141414141414141 instead of going back to the C runtime, " +
      "because line 19 in fill_words overwrote the saved lr in main's frame at step 24.";
    expect(faultText(error!, m.context(), m.lr(), m.pc())?.card.text).toBe(card);
    m.emu.free();
  });
});

// A bad return the frame shows no cause for: the run row and the console say
// what the crate says, word for word, and the explainer keeps its guess.
describe("a ret the frame shows no cause for", () => {
  const GUESS =
    "The base register (the first one inside the brackets, or a pointer passed to a call) does not hold " +
    "an address, usually because `ldr xN, label` lost its `=` (it loads the value stored at the label) or " +
    "a `mov` was written where `ldr xN, =label` was meant";

  // main pushes x19 and never pops it, so its ldp on line 13 takes fp and lr
  // from x19's 16 bytes (5, then 0) and its ret on line 14 goes to 0. Steps:
  // stp, mov, mov, str, mov, ldp, ret, and the fetch at 0 faults on step 8.
  it("keeps the fault as it is when no store reached the saved lr", () => {
    const m = load(`// main pushes x19 and never pops it.
define(fp, x29)
define(lr, x30)
.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x19, 5
        str     x19, [sp, -16]!         // push x19
        mov     w0, 0
        ldp     fp, lr, [sp], 16        // bug: x19's 16 bytes are still on top
        ret
`);
    const { error, steps } = m.run();
    expect(steps).toBe(8);
    expect(error).toBe(`memory fault: the program tried to read 0x0000000000000000, which no section covers. ${GUESS}`);
    const card = returnCard(m.context(), m.lr());
    expect(card).toEqual({
      event: "ret at step 7",
      text: "main's ret on line 14 jumped to 0x0 instead of going back to the C runtime.",
      cause: null,
    });
    expect(faultText(error!, m.context(), m.lr(), m.pc())).toBeNull();
    expect(explainError(error!, card)!.why).toContain("`ldr xN, label` written without its `=`");
    m.emu.free();
  });

  // lr loaded by hand on line 11; main's ret on line 12 goes there at step
  // 5, and the fetch faults on step 6.
  it("keeps the fault as it is when lr was loaded by hand", () => {
    const m = load(`// main returns through an lr it loaded itself.
define(fp, x29)
define(lr, x30)
.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldp     fp, lr, [sp], 16
        ldr     lr, =0x4141414141414141 // bug: lr no longer goes back
        ret
`);
    const { error, steps } = m.run();
    expect(steps).toBe(6);
    expect(error).toBe(`memory fault: the program tried to read 0x4141414141414141, which no section covers. ${GUESS}`);
    expect(returnCard(m.context(), m.lr())?.cause).toBeNull();
    expect(faultText(error!, m.context(), m.lr(), m.pc())).toBeNull();
    m.emu.free();
  });
});

// lr-not-saved.s: show (line 27) calls print_n on line 28 with no prologue,
// so lr holds the address of its own ret on line 29. Steps: main's stp, mov,
// mov and bl show 1 to 4; show's bl print_n 5; print_n's stp, mov, mov, ldr
// and bl printf 6 to 10, two trampoline words and printf 11 to 13, its ldp
// and ret 14 and 15, back on show's ret; that ret, step 16, goes to itself,
// and so does every one after it until the ceiling. main's mov after bl show
// is line 38.
const LR_NOT_SAVED = fixture("lr-not-saved.s");
const MISSING_LR =
  "show's ret on line 29 went back into show instead of going back to main at line 38, " +
  "because show called out with `bl print_n` on line 28 before saving lr, so lr still held " +
  "that call's return address.";

describe("lr not saved before a call", () => {
  it("is explained at the ret that goes back into the function", () => {
    const m = load(LR_NOT_SAVED);
    m.step(15);
    expect(returnCard(m.context(), m.lr())).toBeNull();
    m.step(1);
    expect(returnCard(m.context(), m.lr())).toEqual({ event: "ret at step 16", text: MISSING_LR, cause: "unsaved" });
    m.emu.free();
  });

  // The site runs a million steps a chunk and pauses there with its own words.
  it("is added under a run's pause, with the fix for it", () => {
    const m = load(LR_NOT_SAVED);
    const r = m.emu.run_until_break(1_000_000) as { steps_executed: number; halted: boolean };
    expect(r).toMatchObject({ steps_executed: 1_000_000, halted: false });
    const paused =
      "paused after 1,000,000 steps without finishing. press run to continue, or check for a loop " +
      "whose exit condition never becomes true";
    const said = faultText(paused, m.context(), m.lr(), m.pc());
    expect(said?.error).toBe(`${paused}\n${MISSING_LR}`);
    expect(said?.card).toMatchObject({ text: MISSING_LR, cause: "unsaved" });
    expect(explainError(said!.error, said!.card)!.fix).toMatch(/^Save lr before the function's first call/);
    m.emu.free();
  });

  it("is added under the step ceiling's message, which stays as it is", () => {
    const m = load(LR_NOT_SAVED);
    const { error } = m.run();
    expect(m.emu.take_stdout()).toBe("n = 7\n");
    expect(error).toMatch(/^stopped after 10 million steps, which is the playground's ceiling\. /);
    const said = faultText(error!, m.context(), m.lr(), m.pc());
    expect(said?.error).toBe(`${error}\n${MISSING_LR}`);
    expect(said?.card.text).toBe(MISSING_LR);
    // The ceiling keeps its own explanation.
    expect(explainError(said!.error, said!.card)!.what).toContain("ten-million-instruction ceiling");
    m.emu.free();
  });
});

// callee-saved.s: square (lines 17 to 20) writes x19; main's add on line 30
// reads it. Steps: stp, mov, mov base_r, mov x0, bl square 1 to 5; square's
// mov, mul and ret 6 to 8; main's add 9.
const CALLEE = fixture("callee-saved.s");
const CALLEE_CARD =
  "Line 30 in main reads x19, but square changed it and its ret on line 20 did not put it back. " +
  "x19 to x28 are callee-saved: a function that uses one must save it first and put it back " +
  "before it returns. Do scratch work in x9 to x15, or save x19 on the stack and restore it before ret.";

describe("a callee-saved register a call did not put back", () => {
  it("is marked from the ret and worded when the caller reads it", () => {
    const m = load(CALLEE);
    m.step(7);
    expect(calleeLeftovers(Array.from(m.emu.frames()))).toEqual([]);
    m.step(1);
    expect(calleeLeftovers(Array.from(m.emu.frames()))).toEqual([19]);
    expect(calleeCards(Array.from(m.emu.take_clobber_notes()), m.lines, layoutOf(m.emu))).toEqual([]);
    m.step(1);
    expect(calleeCards(Array.from(m.emu.take_clobber_notes()), m.lines, layoutOf(m.emu))).toEqual([
      { event: "x19 read on line 30", text: CALLEE_CARD },
    ]);
    m.run();
    expect(m.emu.take_stdout()).toBe("20\n");
    m.emu.free();
  });

  // The exercise's starter: double_it (lines 21 to 25) doubles in x19, and
  // main's add on line 43 reads total_r, which is x19.
  it("shows on the Forgetful Helper's starter", () => {
    const exercise = JSON.parse(
      readFileSync(path.join(process.cwd(), "content/exercises/the-forgetful-helper.json"), "utf8"),
    ) as { starter: string; stdin: string };
    const m = load(exercise.starter, exercise.stdin);
    m.run();
    expect(m.emu.take_stdout()).toBe("total = 80\n");
    expect(texts(calleeCards(Array.from(m.emu.take_clobber_notes()), m.lines, layoutOf(m.emu)))).toEqual([
      "Line 43 in main reads x19, but double_it changed it and its ret on line 25 did not put it back. " +
        "x19 to x28 are callee-saved: a function that uses one must save it first and put it back " +
        "before it returns. Do scratch work in x9 to x15, or save x19 on the stack and restore it before ret.",
    ]);
    m.emu.free();
  });
});
