// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { callCard, spokenCard, type CallCard } from "@/lib/emulator/call-cards";
import { readCallCard } from "@/lib/emulator/call-data";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { decodeFrameLayout, decodeFrames, drawFrames } from "@/lib/emulator/stack-frames";

// The call card on real machine states from the node build: the numbers come
// through the wasm export, the words from the card's module. Every expected
// line is worked out by hand from the program's text: what each line loads,
// what the input holds, what the format prints.
const nodeRequire = createRequire(import.meta.url);
const { Emulator, memoryMap } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");
const fixture = (name: string) => read(`lib/test/emulator/fixtures/${name}`);
const LOCALS = read("public/examples/cpsc355/locals.s");
const REGIONS = normalizeMemoryMap(memoryMap());

interface Loaded {
  emu: Machine;
  lineAt: Map<number, number>;
  pcOf: (line: number) => number;
}

function load(source: string, stdin?: string): Loaded {
  const emu = new Emulator();
  const result = emu.assemble_and_load(source) as { error?: string | null };
  expect(result.error ?? null).toBeNull();
  if (stdin != null) emu.push_stdin(stdin);
  const flat = Array.from(emu.get_line_map());
  const lineAt = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) lineAt.set(flat[i], flat[i + 1]);
  const pcOf = (line: number) => [...lineAt].find(([, l]) => l === line)![0];
  return { emu, lineAt, pcOf };
}

/** The card as the console shows it right now. */
function cardNow(p: Loaded): CallCard | null {
  const numbers = readCallCard(p.emu);
  if (!numbers) return null;
  const snapshot = decodeFrames(Array.from(p.emu.frames()))!;
  const stack = drawFrames({
    snapshot,
    layout: decodeFrameLayout({ numbers: Array.from(p.emu.frame_layout()), names: p.emu.frame_names() }),
    sp: Number(p.emu.get_sp()),
    fp: Number(p.emu.get_register(29)),
    pc: Number(p.emu.get_pc()),
    memory: [],
    written: [],
    regions: [],
    lineLabel: () => null,
  });
  const lineLabel = (addr: number) => (p.lineAt.has(addr) ? `line ${p.lineAt.get(addr)}` : null);
  return callCard(numbers, { stack, regions: REGIONS, lineLabel });
}

/** Run until the call on `line` has returned, and read its card. */
function after(p: Loaded, line: number): CallCard {
  const back = p.pcOf(line) + 4;
  p.emu.set_breakpoint(back);
  p.emu.run_until_break(1_000_000);
  p.emu.clear_breakpoint(back);
  expect(Number(p.emu.get_pc())).toBe(back);
  const card = cardNow(p);
  expect(card).not.toBeNull();
  return card!;
}

const texts = (card: CallCard) => card.rows.map((row) => row.text);

describe("the locals example (stdin 7 4)", () => {
  it("says scanf stored 7 in a_s at fp + 16 and 4 in b_s at fp + 20", () => {
    const card = after(load(LOCALS, "7 4\n"), 36);
    expect(card.title).toBe('scanf("%d %d")');
    expect(card.line).toBe("line 36");
    expect(texts(card)).toEqual([
      "%d stored 7 at a_s (fp + 16), the address in x1",
      "%d stored 4 at b_s (fp + 20), the address in x2",
    ]);
    expect(card.outcome).toBe("returned 2 in w0");
    expect(card.rows.every((row) => row.problem === null)).toBe(true);
  });

  it("says each printf's format, values and text: the prompt, then 7 + 4 and 7 * 4", () => {
    const p = load(LOCALS, "7 4\n");
    const prompt = after(p, 31);
    expect([prompt.title, prompt.rows, prompt.outcome]).toEqual([
      'printf("Enter two integers: ")',
      [],
      'printed "Enter two integers: "',
    ]);
    const sums = after(p, 47);
    expect(sums.title).toBe('printf("Sum = %d, Product = %d\\n")');
    expect(texts(sums)).toEqual(["%d printed 11, the value in w1", "%d printed 28, the value in w2"]);
    expect(sums.outcome).toBe('printed "Sum = 11, Product = 28\\n"');
  });

  it("is absent on a wasm build that predates the card", () => {
    expect(readCallCard({})).toBeNull();
  });

  it("is gone one step later, and a step that runs no call has none", () => {
    const p = load(LOCALS, "7 4\n");
    after(p, 36);
    p.emu.step();
    expect(cardNow(p)).toBeNull();
  });

  it("is said in one go, outcome first", () => {
    expect(spokenCard(after(load(LOCALS, "7 4\n"), 36))).toBe(
      'scanf("%d %d") on line 36 returned 2 in w0. ' +
        "%d stored 7 at a_s (fp + 16), the address in x1. %d stored 4 at b_s (fp + 20), the address in x2.",
    );
  });

  it("says a \\n in words, where the card shows it as code", () => {
    const p = load(LOCALS, "7 4\n");
    after(p, 31);
    const sums = after(p, 47);
    expect(sums.outcome).toBe('printed "Sum = 11, Product = 28\\n"');
    // The spaces around the words are not heard.
    expect(spokenCard(sums)).toBe(
      'printf("Sum = %d, Product = %d new line ") on line 47 printed "Sum = 11, Product = 28 new line ". ' +
        "%d printed 11, the value in w1. %d printed 28, the value in w2.",
    );
  });
});

describe("printf, family by family (call-printf.s)", () => {
  const p = load(fixture("call-printf.s"));

  // mov w1, -5 leaves x1 = 0xfffffffb; %d reads the low 32 bits, so -5. mov
  // w3, -1 sets all 32 bits: 4294967295 unsigned. x5 = 1 << 40.
  it("whole numbers: %d %i %u from w registers, %ld %lld from x registers", () => {
    const card = after(p, 30);
    expect(texts(card)).toEqual([
      "%d printed -5, the value in w1",
      "%i printed 42, the value in w2",
      "%u printed 4294967295, the value in w3",
      "%ld printed -7, the value in x4",
      "%lld printed 1099511627776, the value in x5",
    ]);
    expect(card.outcome).toBe('printed "-5 42 4294967295 -7 1099511627776\\n"');
  });

  it("hex: %x and %lx with the value in decimal beside it", () => {
    expect(texts(after(p, 36))).toEqual([
      "%x printed ff, the value in w1 (255)",
      "%lx printed ffffffffffffffff, the value in x2 (18446744073709551615)",
    ]);
  });

  it("%c with its code, %s from the label its address names, and %% from no register", () => {
    const card = after(p, 42);
    expect(texts(card)).toEqual([
      '%c printed "A", the value in w1 (65)',
      '%s printed "hi" from word_m, the address in x2',
      '%% printed "%"',
    ]);
    expect(card.outcome).toBe('printed "Ahi%\\n"');
  });

  it("doubles: %f and %lf from d0 and d1", () => {
    expect(texts(after(p, 48))).toEqual([
      "%f printed 2.500000, the value in d0",
      "%lf printed -0.125000, the value in d1",
    ]);
  });

  it("%p from x1", () => {
    expect(texts(after(p, 53))).toEqual(["%p printed 0x1234, the value in x1"]);
  });
});

describe("scanf, family by family (call-scanf.s)", () => {
  const p = load(fixture("call-scanf.s"), "-12 0x10 7 9000000000 -3\n1f ff Z cat 2.5 0.5\n");

  it("whole numbers into .bss, each named by its label", () => {
    const card = after(p, 40);
    expect(card.title).toBe('scanf("%d %i %u %ld %lld")');
    expect(texts(card)).toEqual([
      "%d stored -12 at int_m, the address in x1",
      "%i stored 16 at any_m, the address in x2",
      "%u stored 7 at uint_m, the address in x3",
      "%ld stored 9000000000 at long_m, the address in x4",
      "%lld stored -3 at llong_m, the address in x5",
    ]);
    expect(card.outcome).toBe("returned 5 in w0");
  });

  it("hex, a character, a word, a float and a double", () => {
    const card = after(p, 50);
    expect(texts(card)).toEqual([
      "%x stored 0x1f at hex_m, the address in x1",
      "%lx stored 0xff at lhex_m, the address in x2",
      '%c stored "Z" at char_m, the address in x3',
      '%s stored "cat" at word_m, the address in x4',
      "%f stored 2.5 at float_m, the address in x5",
      "%lf stored 0.5 at double_m, the address in x6",
    ]);
    expect(card.outcome).toBe("returned 6 in w0");
  });
});

describe("what goes wrong", () => {
  it("more conversions than argument registers: the eighth %d is read from the stack", () => {
    const card = after(load(fixture("too-many-conversions.s")), 25);
    expect(texts(card)).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `%d printed ${n}, the value in w${n}`),
      // [sp + 0] is main's saved fp: 0, main having no caller frame.
      "%d printed 0, the value at sp + 0",
    ]);
    expect(card.rows[7].problem).toBe("x1 to x7 were all used, so printf read this value from the stack.");
    expect(card.rows.slice(0, 7).every((row) => row.problem === null)).toBe(true);
  });

  it("a %s whose register holds no string address stops printf there", () => {
    const p = load(fixture("not-a-string.s"));
    p.emu.run_until_break(1_000_000);
    expect(p.emu.is_halted()).toBe(true);
    const card = cardNow(p)!;
    expect([card.title, card.line, card.outcome]).toEqual([
      'printf("name: %s\\n")',
      "line 19",
      "stopped the program, so nothing was printed",
    ]);
    expect(card.rows).toEqual([
      {
        text: "%s stopped printf: the value in x1 is 0x7",
        problem: "0x7 is not the address of a string, so printf had nothing to read.",
      },
    ]);
  });

  it("rows before a stop say what printf read, since nothing was printed", () => {
    const p = load(`// Prints a percentage and a name, but x2 holds a number where the
// name's address belongs.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%d%% of %s\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_out
        mov     w1, 50
        mov     x2, 0x5678
        movk    x2, 0x1234, lsl 16          // a number, not an address
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`);
    p.emu.run_until_break(1_000_000);
    expect(p.emu.take_stdout()).toBe("");
    const card = cardNow(p)!;
    expect(texts(card)).toEqual([
      "%d read 50, the value in w1",
      '%% stands for "%"',
      "%s stopped printf: the value in x2 is 0x12345678",
    ]);
    expect(card.outcome).toBe("stopped the program, so nothing was printed");
  });

  it("a printf stopped by its one-call limit says what its rows read, not what they printed", () => {
    // "7 " and a field 1 MiB + 1 wide: over the most one printf may make.
    const source = `.data\nfmt_out:    .string "%d %1048577d\\n"\n\n.text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        ldr     x0, =fmt_out\n        mov     w1, 7\n        mov     w2, 8\n        bl      printf\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n`;
    const p = load(source);
    p.emu.run_until_break(1_000_000);
    expect(p.emu.take_stdout()).toBe("");
    const card = cardNow(p)!;
    expect(texts(card)).toEqual([
      "%d read 7, the value in w1",
      // The card keeps the text's first 256 bytes: "7 " and 254 of the spaces.
      `%1048577d read "${" ".repeat(254)}…", the value in w2`,
    ]);
    expect(card.outcome).toBe("stopped the program, so nothing was printed");
  });

  it("a scanf handed a value where an address belongs stores at that value", () => {
    const card = after(load(fixture("scanf-value.s"), "7\n"), 24);
    expect(card.rows).toEqual([
      {
        text: "%d stored 7 at 0x0, which is not one of your variables",
        problem:
          "x1 should hold the address of a variable (add x1, fp, its offset for a local, or ldr x1, =its label), " +
          "not its value. On the course server this stops the program.",
      },
    ]);
  });

  it("input that does not fit stops scanf at that conversion", () => {
    const card = after(load(LOCALS, "x 4\n"), 36);
    expect(texts(card)).toEqual(['%d stored nothing: the input "x" does not fit it, so scanf stopped there']);
    expect(card.outcome).toBe("returned 0 in w0");
  });

  it("input that ends first leaves scanf returning -1", () => {
    const p = load(LOCALS);
    p.emu.close_stdin();
    const card = after(p, 36);
    expect(texts(card)).toEqual(["%d stored nothing: the input ended first"]);
    expect(card.outcome).toBe("returned -1 in w0: the input ended before anything was read");
  });
});

describe("where a stored value went", () => {
  // read_one(x0 = &n) is handed main's local; its own frame is the innermost,
  // so the slot is named with its owner instead of an fp offset.
  const PASSED = `// main hands read_one the address of its local n; read_one fills it with scanf.

define(fp, x29)
define(lr, x30)

n_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_in:     .string "%d"

.text
// read_one(x0 = address of an int)
        .balign 4
        .global read_one
read_one:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x1, x0                      // scanf's pointer: the caller's int
        ldr     x0, =fmt_in
        bl      scanf
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x0, fp, n_s
        bl      read_one
        ldr     w0, [fp, n_s]               // main returns n
        ldp     fp, lr, [sp], dealloc
        ret
`;

  it("names a caller's slot by its owner's frame", () => {
    const card = after(load(PASSED, "5\n"), 22);
    expect(texts(card)).toEqual(["%d stored 5 at n_s in main's frame, the address in x1"]);
  });

  it("calls a slot with no name by its offset, once", () => {
    const unnamed = `// Reads a number into main's frame at fp + 16, a slot with no name.

define(fp, x29)
define(lr, x30)

.data
fmt_in:     .string "%d"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, 16                  // no name for this slot
        bl      scanf

        ldr     w0, [fp, 16]                // main returns the number
        ldp     fp, lr, [sp], 32
        ret
`;
    const card = after(load(unnamed, "42\n"), 18);
    expect(texts(card)).toEqual(["%d stored 42 at fp + 16, the address in x1"]);
  });

  it("counts the conversions past the ones the card keeps", () => {
    const fmt = "%%".repeat(40);
    const source = `.data\nfmt_out:    .string "${fmt}"\n\n.text\n        .balign 4\n        .global main\nmain:\n        stp     x29, x30, [sp, -16]!\n        ldr     x0, =fmt_out\n        bl      printf\n        mov     w0, 0\n        ldp     x29, x30, [sp], 16\n        ret\n`;
    const card = after(load(source), 10);
    expect(card.rows).toHaveLength(33);
    expect(card.rows[32].text).toBe("and 8 more conversions");
  });
});
