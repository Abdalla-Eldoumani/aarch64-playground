// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// What loading a program hands the editor: the assemble result, the line map
// and the frame layout, read from the real node build through both load
// calls. Every expected value is written out by hand; neither call is
// checked against the other, since both would then pass if both changed.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

type EmulatorInstance = InstanceType<typeof Emulator>;

function withEmulator<T>(fn: (emu: EmulatorInstance) => T): T {
  const emu = new Emulator();
  try {
    return fn(emu);
  } finally {
    emu.free();
  }
}

const CODE_BASE = 0x40_0000;

/** A hosted program with main at CODE_BASE, `body` on line 5. */
const hosted = (body: string) =>
  [
    "        .text",
    "        .global main",
    "main:   stp     x29, x30, [sp, -16]!",
    "        mov     x29, sp",
    body,
    "        mov     w0, 0",
    "        ldp     x29, x30, [sp], 16",
    "        ret",
    "",
  ].join("\n");

const LOADED = hosted("        mov     x1, 7");
// Six instructions on lines 3 to 8, one word apart from CODE_BASE.
const LOADED_LINE_MAP = [
  CODE_BASE, 3,
  CODE_BASE + 4, 4,
  CODE_BASE + 8, 5,
  CODE_BASE + 12, 6,
  CODE_BASE + 16, 7,
  CODE_BASE + 20, 8,
];
// One function: entry, end (six words on), name 0 ("main"), a 16-byte frame
// that pushes a record, no slots, no arrays.
const LOADED_FRAME_LAYOUT = [1, CODE_BASE, CODE_BASE + 24, 0, 16, 1, 0, 0];
// No functions.
const NO_FRAME_LAYOUT = [0];

/** `stp x29, x30, [sp, -16]!` then `mov x29, sp`, little-endian. */
const LOADED_FIRST_WORDS = [0xfd, 0x7b, 0xbf, 0xa9, 0xfd, 0x03, 0x00, 0x91];

const succeeded = (instruction_count: number) => ({
  success: true,
  error: undefined,
  error_line: undefined,
  instruction_count,
});

const failed = (error: string, error_line?: number) => ({
  success: false,
  error,
  error_line,
  instruction_count: 0,
});

const UNKNOWN_IFDEF = "unsupported m4 construct: ifdef";

const LOADS = [
  { name: "assemble_and_load", load: (emu: EmulatorInstance, source: string) => emu.assemble_and_load(source) },
  {
    name: "assemble_and_load_with_args",
    load: (emu: EmulatorInstance, source: string) => emu.assemble_and_load_with_args(source, ["one"]),
  },
];

describe.each(LOADS)("$name", ({ load }) => {
  // A hosted program that assembles: its instruction count, each
  // instruction's line, and main's frame.
  it("loads a hosted program with its line map and frame layout", () => {
    withEmulator((emu) => {
      expect(load(emu, LOADED)).toStrictEqual(succeeded(6));
      expect(Array.from(emu.get_line_map())).toEqual(LOADED_LINE_MAP);
      expect(Array.from(emu.frame_layout())).toEqual(LOADED_FRAME_LAYOUT);
      expect(emu.frame_names()).toEqual(["main"]);
    });
  });

  // An instruction the assembler cannot encode: its message alone, at its line.
  it("names the line of an instruction it cannot encode", () => {
    withEmulator((emu) => {
      expect(load(emu, hosted("        add     x0, x1"))).toStrictEqual(
        failed("ADD/SUB takes 3 operands, or 4 with a shift modifier (add x0, x1, x2, lsl #3)", 5),
      );
    });
  });

  // An m4 construct the playground does not run: m4's message, at its line.
  it("names the line of an m4 construct it does not run", () => {
    withEmulator((emu) => {
      expect(load(emu, "define(x, `abc')\nifdef(FOO, bar)\n" + hosted(""))).toStrictEqual(failed(UNKNOWN_IFDEF, 2));
    });
  });

  // A string with no closing quote: the reader's message, at its line.
  it("names the line of a string with no closing quote", () => {
    withEmulator((emu) => {
      expect(load(emu, hosted('        .string "abc'))).toStrictEqual(
        failed('unterminated string literal: no closing " before the end of the line (write \\n for a newline)', 5),
      );
    });
  });

  // A program with no main fails the link at line 0, which is a line and
  // not a missing one.
  it("reports line 0 for a program with no main", () => {
    withEmulator((emu) => {
      expect(load(emu, "        .text\nfoo:    ret\n")).toStrictEqual(
        failed(
          "undefined reference to `main'\nno line defines `main:`, where every program starts: " +
            "add `.global main` and then `main:` above the first instruction",
          0,
        ),
      );
    });
  });

  // A bare-metal program (no sections, no library calls) loads at
  // CODE_BASE with no line map and no frames.
  it("loads a bare-metal program with no line map", () => {
    withEmulator((emu) => {
      expect(load(emu, "mov x0, 5\nadd x1, x0, 2\n")).toStrictEqual(succeeded(2));
      expect(Array.from(emu.get_line_map())).toEqual([]);
      expect(Array.from(emu.frame_layout())).toEqual(NO_FRAME_LAYOUT);
    });
  });

  // A bare-metal instruction the assembler cannot encode: its message alone,
  // at its line.
  it("names the line of a bare-metal instruction it cannot encode", () => {
    withEmulator((emu) => {
      expect(load(emu, "mov x0, 5\nfrob x1, x0\n")).toStrictEqual(
        failed(
          "unknown mnemonic `frob' -- `frob x1,x0'\n" +
            "check the spelling, or look it up in the instruction reference to see whether the playground implements it",
          2,
        ),
      );
    });
  });

  // On the bare-metal path only an assembler error carries a line: an m4
  // error arrives as its whole text, with no line.
  it("gives a bare-metal m4 error its whole text and no line", () => {
    withEmulator((emu) => {
      expect(load(emu, "mov x0, 5\nifdef(FOO, bar)\n")).toStrictEqual(
        failed(`preprocess error at line 2: ${UNKNOWN_IFDEF}`),
      );
    });
  });

  // A bare-metal program that fails to assemble leaves the program already
  // loaded where it was, but drops its line map and frames.
  it("keeps the loaded program when a bare-metal assemble fails", () => {
    withEmulator((emu) => {
      expect(load(emu, LOADED)).toStrictEqual(succeeded(6));
      emu.step();
      expect(load(emu, "mov x0, 5\nfrob x1, x0\n")).toMatchObject({ success: false, error_line: 2 });
      expect(emu.get_pc()).toBe(BigInt(CODE_BASE + 4));
      // sp after `stp x29, x30, [sp, -16]!` from the stack base 0x8000_0000.
      expect(emu.get_sp()).toBe(0x7fff_fff0n);
      expect(Array.from(emu.get_memory_range(CODE_BASE, 8))).toEqual(LOADED_FIRST_WORDS);
      expect(Array.from(emu.get_line_map())).toEqual([]);
      expect(Array.from(emu.frame_layout())).toEqual(NO_FRAME_LAYOUT);
      expect(emu.frame_names()).toEqual([]);
    });
  });

  // A hosted program that fails to assemble clears the machine: pc at
  // CODE_BASE, sp at the stack base, empty memory, no line map, no frames.
  it("clears the machine when a hosted assemble fails", () => {
    withEmulator((emu) => {
      expect(load(emu, LOADED)).toStrictEqual(succeeded(6));
      emu.step();
      expect(load(emu, hosted('        .string "abc'))).toMatchObject({ success: false, error_line: 5 });
      expect(emu.get_pc()).toBe(BigInt(CODE_BASE));
      expect(emu.get_sp()).toBe(0x8000_0000n);
      expect(emu.get_register(0)).toBe(0n);
      expect(Array.from(emu.get_memory_range(CODE_BASE, 8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(Array.from(emu.get_line_map())).toEqual([]);
      expect(Array.from(emu.frame_layout())).toEqual(NO_FRAME_LAYOUT);
      expect(emu.frame_names()).toEqual([]);
    });
  });
});

const PRINT_ARGS = [
  "        .text",
  'fmt:    .string "argc %d, argv[2] %s\\n"',
  "        .balign 4",
  "        .global main",
  "main:   stp     x29, x30, [sp, -16]!",
  "        mov     x29, sp",
  "        ldr     x2, [x1, 16]",
  "        mov     w1, w0",
  "        adrp    x0, fmt",
  "        add     x0, x0, :lo12:fmt",
  "        bl      printf",
  "        mov     w0, 0",
  "        ldp     x29, x30, [sp], 16",
  "        ret",
  "",
].join("\n");

const PRINT_ARGC = [
  "        .text",
  'fmt:    .string "argc %d\\n"',
  "        .balign 4",
  "        .global main",
  "main:   stp     x29, x30, [sp, -16]!",
  "        mov     x29, sp",
  "        mov     w1, w0",
  "        adrp    x0, fmt",
  "        add     x0, x0, :lo12:fmt",
  "        bl      printf",
  "        mov     w0, 0",
  "        ldp     x29, x30, [sp], 16",
  "        ret",
  "",
].join("\n");

function stdoutOf(emu: EmulatorInstance): string {
  const run = emu.run_until_break(100_000) as { error?: string | null };
  expect(run.error ?? null).toBeNull();
  return emu.take_stdout();
}

describe("assemble_and_load_with_args", () => {
  // The args box's words reach main: argc counts the program name too, and
  // argv[2] is the second word as typed, space included.
  it("hands main argc and argv", () => {
    withEmulator((emu) => {
      expect(emu.assemble_and_load_with_args(PRINT_ARGS, ["one", "two words"])).toStrictEqual(succeeded(10));
      expect(stdoutOf(emu)).toBe("argc 3, argv[2] two words\n");
    });
  });

  // Arguments too long for the 4 KiB argv page: the whole message, no line.
  // The line map is already in place by then; the frames are not.
  it("refuses arguments longer than the argv page", () => {
    withEmulator((emu) => {
      // 24 bytes of pointers (argv[0], argv[1], NULL), "./program\0" (10),
      // then 5,000 letters and their NUL (5,001).
      expect(emu.assemble_and_load_with_args(LOADED, ["a".repeat(5000)])).toStrictEqual(
        failed(
          "the arguments need 5035 bytes, more than the 4 KiB the playground reserves for argv. " +
            "Shorten the args box above the editor, or pass fewer arguments",
        ),
      );
      expect(Array.from(emu.get_line_map())).toEqual(LOADED_LINE_MAP);
      expect(Array.from(emu.frame_layout())).toEqual(NO_FRAME_LAYOUT);
    });
  });
});

describe("assemble_and_load", () => {
  // With no args box, main still sees argc 1: the program name alone.
  it("hands main argc 1", () => {
    withEmulator((emu) => {
      expect(emu.assemble_and_load(PRINT_ARGC)).toStrictEqual(succeeded(9));
      expect(stdoutOf(emu)).toBe("argc 1\n");
    });
  });
});

describe("m4_expand", () => {
  // The terminal's m4 step: a define leaves its blank line behind.
  it("expands a define", () => {
    withEmulator((emu) => {
      expect(emu.m4_expand("define(n, 5)\nmov x0, n\n")).toStrictEqual({ success: true, text: "\nmov x0, 5" });
    });
  });

  // An m4 construct the playground does not run: m4's message, at its line.
  it("names the line of an m4 construct it does not run", () => {
    withEmulator((emu) => {
      expect(emu.m4_expand("mov x0, 1\nifdef(FOO, bar)\n")).toStrictEqual({
        success: false,
        error: UNKNOWN_IFDEF,
        error_line: 2,
      });
    });
  });
});
