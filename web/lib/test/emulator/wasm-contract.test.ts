// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The wrapper contract the web layer leans on, pinned against the real
// node-target emulator: step_back restores registers and memory, breakpoints
// stop at the exact pc the line map can name, save/load round-trips machine
// state including the VFS, scanf blocks until stdin arrives, argv lands where
// main reads it, fmov shows in the FP surface, and str reports its dirty
// range. Every expected value is derived by hand in the comments, never by
// running the code path under test.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator, memoryMap } = nodeRequire(
  wasmNodePath,
) as typeof import("@/lib/wasm-node/aarch64_emulator");

type EmulatorInstance = InstanceType<typeof Emulator>;

interface RawAssemble {
  success: boolean;
  error?: string | null;
  instruction_count: number;
}

interface RawRun {
  pc: bigint | number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error?: string | null;
}

function withEmulator<T>(fn: (emu: EmulatorInstance) => T): T {
  const emu = new Emulator();
  try {
    return fn(emu);
  } finally {
    emu.free();
  }
}

function assemble(emu: EmulatorInstance, source: string): RawAssemble {
  const result = emu.assemble_and_load(source) as RawAssemble;
  expect(result.error ?? null, "program failed to assemble").toBeNull();
  expect(result.success).toBe(true);
  return result;
}

/** Read one 64-bit little-endian value from machine memory. */
function readU64(emu: EmulatorInstance, addr: number): bigint {
  const bytes = emu.get_memory_range(addr, 8);
  expect(bytes.length).toBe(8);
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]);
  return value;
}

/** Read a NUL-terminated string from machine memory. */
function readCString(emu: EmulatorInstance, addr: number, max = 64): string {
  const bytes = emu.get_memory_range(addr, max);
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end < 0 ? max : end));
}

// Editor lines (1-based): 4=stp 5=mov x29 6=mov 111 7=str 8=mov 222,
// 9 is the `after:` label, 10=second str, 11=mov w0 12=ldp 13=ret.
// The two str instructions write the same frame slot so stepping back over
// the second one must expose the first one's value again.
const STORE_TWICE = `        .text
        .global main
main:
        stp     x29, x30, [sp, -32]!
        mov     x29, sp
        mov     x19, 111
        str     x19, [x29, 16]
        mov     x19, 222
after:
        str     x19, [x29, 16]
        mov     w0, 0
        ldp     x29, x30, [sp], 32
        ret
`;

describe("lint_source over the real build", () => {
  it("warns on the missing-prologue shape and stays quiet on clean code", () => {
    withEmulator((emu) => {
      const lintSource = (emu as unknown as { lint_source: (s: string) => unknown }).lint_source.bind(emu);
      const warn = lintSource(
        ".text\n.global main\nmain:\nmov x0, 0\nldp x29, x30, [sp], 16\nret\n",
      ) as Array<{ line: number; message: string }>;
      expect(warn).toHaveLength(1);
      expect(warn[0].line).toBe(5);
      expect(warn[0].message).toContain("never pushed");

      const clean = lintSource(
        ".text\n.global main\nmain:\nstp x29, x30, [sp, -16]!\nmov x0, 0\nldp x29, x30, [sp], 16\nret\n",
      ) as Array<{ line: number; message: string }>;
      expect(clean).toHaveLength(0);
    });
  });
});

describe("step_back restores registers and memory", () => {
  it("undoes a str's memory write and a mov's register write, one frame at a time", () => {
    withEmulator((emu) => {
      assemble(emu, STORE_TWICE);
      const base = emu.code_base();
      // sp starts at the machine's stack top; stp allocates 32 bytes, so
      // fp = initial sp - 32 and the slot sits at fp + 16.
      const initialSp = Number(emu.get_sp());
      const slot = initialSp - 32 + 16;
      for (let i = 0; i < 6; i++) emu.step();
      // After 6 steps (stp, mov, mov, str, mov, str): x19 = 222, slot = 222.
      expect(emu.get_register(19)).toBe(222n);
      expect(readU64(emu, slot)).toBe(222n);
      expect(Number(emu.get_pc())).toBe(base + 24);
      expect(emu.can_step_back()).toBe(true);

      // Undo the second str: the slot shows 111 again, x19 still 222.
      emu.step_back();
      expect(Number(emu.get_pc())).toBe(base + 20);
      expect(emu.get_register(19)).toBe(222n);
      expect(readU64(emu, slot)).toBe(111n);

      // Undo `mov x19, 222`: the register write is restored too.
      emu.step_back();
      expect(Number(emu.get_pc())).toBe(base + 16);
      expect(emu.get_register(19)).toBe(111n);
      expect(readU64(emu, slot)).toBe(111n);
    });
  });
});

describe("breakpoints and the line map", () => {
  it("run_until_break stops on the exact breakpoint pc and the map names its editor line", () => {
    withEmulator((emu) => {
      assemble(emu, STORE_TWICE);
      const base = emu.code_base();
      // `after:` labels the sixth instruction: base + 5 * 4.
      expect(emu.resolve_label("after")).toBe(BigInt(base + 20));
      expect(emu.resolve_label("nowhere")).toBeUndefined();

      emu.set_breakpoint(base + 20);
      const run = emu.run_until_break(1000) as RawRun;
      expect(run.hit_breakpoint).toBe(true);
      expect(run.error ?? null).toBeNull();
      // Five instructions execute before the breakpoint address.
      expect(run.steps_executed).toBe(5);
      expect(Number(emu.get_pc())).toBe(base + 20);
      expect(emu.is_halted()).toBe(false);

      // The flat [addr, line, ...] map pairs the stopped pc with editor
      // line 10; the label line 9 carries no instruction.
      const flat = Array.from(emu.get_line_map());
      const index = flat.indexOf(base + 20);
      expect(index % 2).toBe(0);
      expect(flat[index + 1]).toBe(10);

      // Continuing runs to the ret and exits with main's w0 = 0.
      const rest = emu.run_until_break(1000) as RawRun;
      expect(rest.error ?? null).toBeNull();
      expect(emu.is_halted()).toBe(true);
      expect(emu.get_exit_code()).toBe(0n);
    });
  });

  it("maps every instruction to its hand-counted editor line, skipping label and directive lines", () => {
    withEmulator((emu) => {
      const result = assemble(emu, STORE_TWICE);
      expect(result.instruction_count).toBe(9);
      const base = emu.code_base();
      const lines = [4, 5, 6, 7, 8, 10, 11, 12, 13];
      const expected = lines.flatMap((line, i) => [base + i * 4, line]);
      expect(Array.from(emu.get_line_map())).toEqual(expected);
    });
  });
});

describe("save_state / load_state / delete_state", () => {
  it("round-trips registers, memory, and the VFS; delete removes the save", () => {
    withEmulator((emu) => {
      assemble(emu, STORE_TWICE);
      const base = emu.code_base();
      const slot = Number(emu.get_sp()) - 32 + 16;
      emu.upload_vfs_file("keep.txt", new TextEncoder().encode("kept"));
      for (let i = 0; i < 4; i++) emu.step();
      // Checkpoint after the first str: x19 = 111, slot = 111, pc = base+16.
      emu.save_state("checkpoint");
      expect(emu.list_states()).toEqual(["checkpoint"]);

      // Mutate everything the save should shield: registers, memory, VFS.
      emu.step();
      emu.step();
      expect(emu.get_register(19)).toBe(222n);
      expect(readU64(emu, slot)).toBe(222n);
      emu.delete_vfs_file("keep.txt");
      emu.upload_vfs_file("new.txt", new TextEncoder().encode("new"));

      expect(emu.load_state("checkpoint")).toBe(true);
      expect(emu.get_register(19)).toBe(111n);
      expect(readU64(emu, slot)).toBe(111n);
      expect(Number(emu.get_pc())).toBe(base + 16);
      expect(emu.list_vfs_files()).toEqual(["keep.txt"]);
      expect(new TextDecoder().decode(emu.read_vfs_file("keep.txt"))).toBe("kept");

      expect(emu.delete_state("checkpoint")).toBe(true);
      expect(emu.list_states()).toEqual([]);
      expect(emu.load_state("checkpoint")).toBe(false);
      expect(emu.delete_state("checkpoint")).toBe(false);
    });
  });
});

// scanf parks the machine on stdin: blocked but not halted, and the run
// resumes once bytes arrive. 21 doubled prints 42.
const SCANF_DOUBLE = `define(fp, x29)
define(lr, x30)

val_s = 16
alloc = -(16 + 16) & -16
dealloc = -alloc

        .text
fmt_in: .string "%d"
fmt_out: .string "twice %d\\n"

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, val_s
        bl      scanf

        ldr     w1, [fp, val_s]
        add     w1, w1, w1
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`;

describe("blocked stdin", () => {
  it("a scanf program blocks without halting, then completes after push_stdin", () => {
    withEmulator((emu) => {
      assemble(emu, SCANF_DOUBLE);
      const first = emu.run_until_break(100_000) as RawRun;
      expect(first.error ?? null).toBeNull();
      expect(first.hit_breakpoint).toBe(false);
      expect(emu.is_blocked()).toBe(true);
      expect(emu.is_halted()).toBe(false);

      emu.push_stdin("21\n");
      expect(emu.is_blocked()).toBe(false);

      const second = emu.run_until_break(100_000) as RawRun;
      expect(second.error ?? null).toBeNull();
      expect(emu.is_halted()).toBe(true);
      expect(emu.get_exit_code()).toBe(0n);
      // 21 + 21 = 42, printed through the fmt_out format string.
      expect(emu.take_stdout()).toBe("twice 42\n");
      // take_stdout drains: a second read is empty.
      expect(emu.take_stdout()).toBe("");
    });
  });
});

const MINIMAL_MAIN = `        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;

describe("argv layout", () => {
  it("assemble_and_load_with_args puts argc in w0 and readable argv strings behind x1", () => {
    withEmulator((emu) => {
      // The wasm surface takes argv[1..]; the loader prepends ./program
      // itself, so argc comes back one higher than the array's length.
      const result = emu.assemble_and_load_with_args(MINIMAL_MAIN, [
        "alpha",
        "beta",
      ]) as RawAssemble;
      expect(result.error ?? null).toBeNull();

      // The loader seeds main's incoming registers before the first step:
      // w0 = argc = 3, x1 = &argv[0].
      expect(emu.get_register(0)).toBe(3n);
      const argvBase = Number(emu.get_register(1));
      expect(argvBase).toBeGreaterThan(0);

      const expected = ["./program", "alpha", "beta"];
      for (let i = 0; i < expected.length; i++) {
        const ptr = readU64(emu, argvBase + i * 8);
        expect(ptr, `argv[${i}] pointer`).not.toBe(0n);
        expect(readCString(emu, Number(ptr))).toBe(expected[i]);
      }
      // argv[argc] is the NULL terminator main's loops rely on.
      expect(readU64(emu, argvBase + expected.length * 8)).toBe(0n);
    });
  });
});

describe("fp registers", () => {
  it("an fmov d0 immediate shows in get_fp_registers and get_changed_fp_registers", () => {
    // 1.5 = 1.1 binary * 2^0: sign 0, biased exponent 1023 = 0x3ff, top
    // fraction bit set, so the IEEE-754 pattern is 0x3ff8000000000000.
    const source = `        .text
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        fmov    d0, 1.5
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;
    withEmulator((emu) => {
      assemble(emu, source);
      const before = emu.get_fp_registers();
      expect(before).toHaveLength(32);
      expect(before[0]).toBe("0x0000000000000000");

      emu.step();
      emu.step();
      expect(Array.from(emu.get_changed_fp_registers())).toEqual([]);

      emu.step(); // fmov d0, 1.5
      const after = emu.get_fp_registers();
      expect(after[0]).toBe("0x3ff8000000000000");
      expect(after[1]).toBe("0x0000000000000000");
      expect(Array.from(emu.get_changed_fp_registers())).toEqual([0]);
    });
  });
});

describe("dirty addresses", () => {
  it("a str reports exactly its written range in take_dirty_addrs, then the buffer is drained", () => {
    withEmulator((emu) => {
      assemble(emu, STORE_TWICE);
      const slot = Number(emu.get_sp()) - 32 + 16;
      for (let i = 0; i < 3; i++) emu.step();
      emu.take_dirty_addrs(); // drop the stp/load-time writes

      emu.step(); // str x19, [x29, 16]: one 8-byte write at the slot
      expect(Array.from(emu.take_dirty_addrs())).toEqual([slot, 8]);
      expect(Array.from(emu.take_dirty_addrs())).toEqual([]);
    });
  });
});

// Course-shaped file reader: openat(AT_FDCWD, "notes.txt", O_RDONLY), read
// into a stack buffer, NUL-terminate, printf("%s"), close, exit 0; exits 1
// when the open fails. The syscall numbers are linux aarch64: 56 openat,
// 63 read, 57 close.
const READ_NOTES = `define(fp, x29)
define(lr, x30)
define(fd_r, w19)

buf_size = 64
alloc = -(16 + buf_size) & -16
dealloc = -alloc
buf_s = 16

        .text
fname:  .string "notes.txt"
fmt:    .string "%s"

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        mov     w0, -100
        ldr     x1, =fname
        mov     w2, 0
        mov     w3, 0
        mov     x8, 56
        svc     0

        cmp     w0, 0
        b.lt    fail
        mov     fd_r, w0

        mov     w0, fd_r
        add     x1, fp, buf_s
        mov     x2, buf_size - 1
        mov     x8, 63
        svc     0

        add     x9, fp, buf_s
        strb    wzr, [x9, x0]
        ldr     x0, =fmt
        add     x1, fp, buf_s
        bl      printf

        mov     w0, fd_r
        mov     x8, 57
        svc     0

        mov     w0, 0
        b       out

fail:
        mov     w0, 1

out:
        ldp     fp, lr, [sp], dealloc
        ret
`;

describe("VFS roundtrip through the machine", () => {
  it("upload, list, read, and delete round-trip a file", () => {
    withEmulator((emu) => {
      expect(emu.list_vfs_files()).toEqual([]);
      // A missing path reads as an empty byte array by contract.
      expect(emu.read_vfs_file("missing.txt").length).toBe(0);

      emu.upload_vfs_file("notes.txt", new TextEncoder().encode("from the vfs\n"));
      expect(emu.list_vfs_files()).toEqual(["notes.txt"]);
      expect(new TextDecoder().decode(emu.read_vfs_file("notes.txt"))).toBe("from the vfs\n");

      expect(emu.delete_vfs_file("notes.txt")).toBe(true);
      expect(emu.delete_vfs_file("notes.txt")).toBe(false);
      expect(emu.list_vfs_files()).toEqual([]);
    });
  });

  it("assemble_and_load clears the VFS, so uploads must follow the assemble", () => {
    // This ordering is the reason the web layer re-seeds the VFS after
    // every assemble; pinned so a change in load semantics is caught.
    withEmulator((emu) => {
      emu.upload_vfs_file("early.txt", new TextEncoder().encode("early"));
      assemble(emu, MINIMAL_MAIN);
      expect(emu.list_vfs_files()).toEqual([]);
    });
  });

  it("a program opens and prints a VFS file through the hosted openat/read path", () => {
    withEmulator((emu) => {
      assemble(emu, READ_NOTES);
      emu.upload_vfs_file("notes.txt", new TextEncoder().encode("from the vfs\n"));
      const run = emu.run_until_break(100_000) as RawRun;
      expect(run.error ?? null).toBeNull();
      expect(emu.is_halted()).toBe(true);
      expect(emu.get_exit_code()).toBe(0n);
      expect(emu.take_stdout()).toBe("from the vfs\n");
    });
  });

  it("the same program exits through its error path when the file is absent", () => {
    withEmulator((emu) => {
      assemble(emu, READ_NOTES);
      const run = emu.run_until_break(100_000) as RawRun;
      expect(run.error ?? null).toBeNull();
      expect(emu.is_halted()).toBe(true);
      expect(emu.get_exit_code()).toBe(1n);
      expect(emu.take_stdout()).toBe("");
    });
  });
});

describe("the exported memory map", () => {
  // The bands the memory panel labels from, transcribed by hand from the
  // loader constants: four 1 MiB sections from CODE_BASE, one page of argv,
  // a 1 MiB heap window, the 1 MiB stack band under STACK_BASE, and 256
  // 16-byte host-stub slots at the top of the space.
  it("hands over eight bands in address order at the loader's constants", () => {
    expect(memoryMap()).toEqual([
      { name: ".text", start: 0x00400000, end: 0x00500000 },
      { name: ".rodata", start: 0x00500000, end: 0x00600000 },
      { name: ".data", start: 0x00600000, end: 0x00700000 },
      { name: ".bss", start: 0x00700000, end: 0x00800000 },
      { name: "argv", start: 0x00800000, end: 0x00801000 },
      { name: "heap", start: 0x00900000, end: 0x00a00000 },
      { name: "stack", start: 0x7ff00000, end: 0x80000000 },
      { name: "host stubs", start: 0xffff0000, end: 0xffff1000 },
    ]);
  });
});

describe("external-call context", () => {
  // Two printf sites, on editor lines 16 and 18 (count the lines: two
  // defines, a blank, the four .rodata lines, a blank, .text, .global, the
  // main label, then the body). Both route through the one shared
  // __tramp_printf, so a static answer could only ever name one of them.
  const TWO_PRINTF = `define(fp, x29)
define(lr, x30)

        .rodata
first_m:
        .string "first\\n"
second_m:
        .string "second\\n"

        .text
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =first_m
        bl      printf
        ldr     x0, =second_m
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

  // A scanf with nothing on stdin parks on the stub address itself; `bl
  // scanf` is editor line 19 (the .bss block adds three lines over the
  // program above, and there are two address loads before the call).
  const BLOCKING_SCANF = `define(fp, x29)
define(lr, x30)

        .rodata
fmt_m:
        .string "%d"

        .bss
value_m:
        .skip   4

        .text
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =fmt_m
        ldr     x1, =value_m
        bl      scanf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`;

  interface RawCallContext {
    name: string;
    call_site_pc: number;
    call_site_line?: number | null;
  }

  function context(emu: EmulatorInstance): RawCallContext | null {
    return (emu.hostCallContext() as RawCallContext | null | undefined) ?? null;
  }

  /** Editor line the assemble's line map gives an address, or null. */
  function lineOf(emu: EmulatorInstance, addr: number): number | null {
    const flat = Array.from(emu.get_line_map());
    for (let i = 0; i + 1 < flat.length; i += 2) {
      if (flat[i] === addr) return flat[i + 1];
    }
    return null;
  }

  it("names each printf's own call site at all three in-call steps", () => {
    withEmulator((emu) => {
      assemble(emu, TWO_PRINTF);
      // assemble_and_load resets the machine, so the pc is main's first
      // instruction: a line the student wrote, not a call.
      expect(context(emu)).toBeNull();

      const seen: Array<{ pc: number; name: string; site: number | null; line: number | null }> =
        [];
      for (let i = 0; i < 500; i++) {
        const ctx = context(emu);
        if (ctx) {
          seen.push({
            pc: Number(emu.get_pc()),
            name: ctx.name,
            site: ctx.call_site_pc,
            line: ctx.call_site_line ?? null,
          });
        }
        if (emu.is_halted()) break;
        const step = emu.step() as { error?: string | null };
        expect(step.error ?? null).toBeNull();
      }

      expect(emu.take_stdout()).toBe("first\nsecond\n");
      // Three in-call pcs per call -- two trampoline words, then the stub --
      // and each resolves to the line its own `bl` sits on.
      expect(seen.map((o) => `${o.name}:${o.line}`)).toEqual([
        "printf:16",
        "printf:16",
        "printf:16",
        "printf:18",
        "printf:18",
        "printf:18",
      ]);
      expect(seen[1].pc - seen[0].pc).toBe(4);
      expect(seen[4].pc).toBe(seen[1].pc);
      // The third pc of each call is a synthetic stub address, inside the
      // band the exported map calls "host stubs".
      const stubs = (memoryMap() as Array<{ name: string; start: number; end: number }>).find(
        (r) => r.name === "host stubs",
      )!;
      for (const index of [2, 5]) {
        expect(seen[index].pc >= stubs.start && seen[index].pc < stubs.end).toBe(true);
      }
      // The reported call site is the `bl` instruction itself.
      expect(lineOf(emu, seen[0].site!)).toBe(16);
      expect(lineOf(emu, seen[3].site!)).toBe(18);
    });
  });

  it("names the call a blocked scanf is parked in", () => {
    withEmulator((emu) => {
      assemble(emu, BLOCKING_SCANF);
      for (let i = 0; i < 200 && !emu.is_blocked(); i++) emu.step();
      expect(emu.is_blocked()).toBe(true);

      const ctx = context(emu);
      expect(ctx?.name).toBe("scanf");
      expect(ctx?.call_site_line).toBe(19);
      expect(lineOf(emu, ctx!.call_site_pc)).toBe(19);
    });
  });

  it("answers null for a program that calls nothing hosted", () => {
    withEmulator((emu) => {
      assemble(emu, MINIMAL_MAIN);
      for (let i = 0; i < 50; i++) {
        expect(context(emu)).toBeNull();
        if (emu.is_halted()) break;
        emu.step();
      }
      expect(emu.is_halted()).toBe(true);
    });
  });
});

describe("m4 expansion", () => {
  // define(total, x19) collapses to a blank line (line numbers must hold)
  // and every later `total` token becomes x19. Lines join with \n and no
  // trailing newline, so the expected text is "" + "\n" + "    mov x19, 5".
  it("substitutes define() aliases and blanks the define line", () => {
    withEmulator((emu) => {
      const result = emu.m4_expand("define(total, x19)\n    mov total, 5") as {
        success: boolean;
        text?: string;
      };
      expect(result.success).toBe(true);
      expect(result.text).toBe("\n    mov x19, 5");
    });
  });

  // aa -> bb -> aa never settles; the expander gives up after its recursion
  // ceiling and blames line 3, the line that uses the cyclic alias.
  it("reports a cyclic define as an error on the line that uses it", () => {
    withEmulator((emu) => {
      const result = emu.m4_expand("define(aa, bb)\ndefine(bb, aa)\n    mov aa, 5") as {
        success: boolean;
        error?: string;
        error_line?: number;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("recursion");
      expect(result.error_line).toBe(3);
    });
  });
});
