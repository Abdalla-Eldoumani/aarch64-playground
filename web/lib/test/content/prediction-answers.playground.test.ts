// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { loadAllExercises } from "@/lib/content/exercises";
import type { PredictionExercise } from "@/lib/content/exercise-schema";
import { typedAnswerIsRight } from "@/lib/content/theory-answers";

// What the machine shows is marked by the same check a student's typed answer
// gets. A question set at a made-up address (sp = 0x8000) runs at a real one
// and reports the same distance from it. Questions about conventions or sizes
// on paper have nothing to run.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");
type Machine = InstanceType<typeof Emulator>;

const hex = (v: bigint | number) => `0x${BigInt(v).toString(16)}`;
const hex32 = (v: bigint) => `0x${BigInt.asUintN(32, v).toString(16).padStart(8, "0")}`;
const signed32 = (v: bigint) => String(BigInt.asIntN(32, v));
const signed64 = (v: bigint) => String(BigInt.asIntN(64, v));
const label = (m: Machine, name: string) => Number(m.resolve_label(name));
const u32At = (m: Machine, addr: number) => new DataView(m.get_memory_range(addr, 4).buffer).getUint32(0, true);
const u64At = (m: Machine, addr: number) => new DataView(m.get_memory_range(addr, 8).buffer).getBigUint64(0, true);
/** A d or s register as a decimal with one digit after the point. */
function fp(m: Machine, n: number, single: boolean): string {
  const bits = BigInt(m.get_fp_registers()[n]);
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, bits, true);
  return (single ? view.getFloat32(0, true) : view.getFloat64(0, true)).toFixed(1);
}

interface Row {
  slug: string;
  index: number;
  /** Lines of the question's code this program runs, so an edit to the
   *  question cannot leave the row checking something else. */
  uses: string[];
  /** main's body; execution stops at `done`, which follows it. */
  body: string;
  /** Appended after `done`: data and helper functions. */
  after?: string;
  read: (m: Machine, entrySp: bigint) => string;
}

const BUF = "        .data\n        .balign 16\nbuf:    .skip 64\nmid:    .skip 64\n";

const ROWS: Row[] = [
  {
    slug: "predict-armv8",
    index: 0,
    uses: ["stp x29, x30, [sp, -32]!", "mov x29, sp"],
    body: "stp x29, x30, [sp, -32]!\nmov x29, sp",
    read: (m, sp) => hex(0x8000n + (m.get_register(29) - sp)),
  },
  { slug: "predict-armv8", index: 1, uses: ["sdiv w0, w1, w2"], body: "mov w1, 14\nmov w2, 3\nsdiv w0, w1, w2", read: (m) => signed32(m.get_register(0)) },
  { slug: "predict-armv8", index: 2, uses: ["udiv x21, x22, x23"], body: "mov x22, 10\nmov x23, 0\nudiv x21, x22, x23", read: (m) => signed64(m.get_register(21)) },
  {
    slug: "predict-arrays",
    index: 1,
    uses: ["ldrb w21, [x20, OFFSET]"],
    // array[1][2] of a 2x3 char array holds 6 here; the answer goes in as OFFSET.
    body: "ldr x20, =array\nldrb w21, [x20, OFFSET]",
    after: "        .data\narray:  .byte 1, 2, 3, 4, 5, 6\n",
    read: (m) => (m.get_register(21) === 6n ? "ANSWER" : `loaded ${m.get_register(21)}`),
  },
  {
    slug: "predict-arrays",
    index: 2,
    uses: ["ldr x21, [x20, OFFSET]"],
    body: "ldr x20, =myArray\nldr x21, [x20, OFFSET]",
    after: "        .data\nmyArray: .dword 10, 20, 30, 40, 50\n",
    read: (m) => (m.get_register(21) === 30n ? "ANSWER" : `loaded ${m.get_register(21)}`),
  },
  { slug: "predict-binary-arithmetic", index: 0, uses: ["add w20, w20, 2"], body: "mov w20, -1\nadd w20, w20, 2", read: (m) => signed32(m.get_register(20)) },
  {
    slug: "predict-binary-arithmetic",
    index: 1,
    uses: ["adds x27, x21, x24", "adcs x26, x20, x23"],
    body: "mov x20, 5\nmov x23, 7\nmov x21, -1\nmov x24, 1\nadds x27, x21, x24\nadcs x26, x20, x23",
    read: (m) => signed64(m.get_register(26)),
  },
  {
    slug: "predict-binary-arithmetic",
    index: 2,
    uses: ["smull x22, w20, w21"],
    body: "mov w20, 2\nmov w21, -5\nsmull x22, w20, w21",
    read: (m) => `0x${m.get_register(22).toString(16).padStart(16, "0")}`,
  },
  { slug: "predict-binary-logic", index: 0, uses: ["lsl w19, w20, 3"], body: "mov w20, 5\nlsl w19, w20, 3", read: (m) => signed32(m.get_register(19)) },
  { slug: "predict-binary-logic", index: 1, uses: ["lsr w19, w20, 1"], body: "mov w20, -8\nlsr w19, w20, 1", read: (m) => hex32(m.get_register(19)) },
  {
    slug: "predict-binary-logic",
    index: 2,
    uses: ["bic x19, x20, x21"],
    body: "mov x20, 0xFF\nmov x21, 0x3C\nbic x19, x20, x21",
    read: (m) => (m.get_register(19) & 0xffn).toString(2).padStart(8, "0"),
  },
  { slug: "predict-binary-logic", index: 3, uses: ["sxtb w19, w20"], body: "mov w20, 0xFF\nsxtb w19, w20", read: (m) => hex32(m.get_register(19)) },
  {
    slug: "predict-branching",
    index: 0,
    uses: ["csel w0, w1, w2, hi"],
    body: "mov w1, -5\nmov w2, 3\ncmp w1, w2\ncsel w0, w1, w2, hi",
    read: (m) => signed32(m.get_register(0)),
  },
  {
    slug: "predict-branching",
    index: 1,
    uses: ["cinc w0, w0, eq", "cinc w0, w0, gt", "cset w2, lt"],
    body: "mov w0, 5\nmov w1, 4\ncmp w1, 4\ncinc w0, w0, eq\ncmp w1, 9\ncinc w0, w0, gt\ncset w2, lt\nadd w0, w0, w2",
    read: (m) => signed32(m.get_register(0)),
  },
  {
    slug: "predict-branching",
    index: 2,
    uses: ["cbnz w2, out", "b.gt bigger"],
    body: "mov w0, 0\nmov w1, 5\nmov w2, 0\ncmp w1, 2\ncbnz w2, out\nb.gt bigger\nmov w0, 1\nb out\nbigger:\nmov w0, 2\nout:",
    read: (m) => signed32(m.get_register(0)),
  },
  {
    slug: "predict-branching",
    index: 3,
    uses: ["cbz w20, out", "cbnz w20, loop"],
    body: "mov w19, 0\nmov w20, 6\ncbz w20, out\nloop:\nadd w19, w19, w20\nsub w20, w20, 2\ncbnz w20, loop\nout:",
    read: (m) => signed32(m.get_register(19)),
  },
  {
    slug: "predict-branching",
    index: 4,
    uses: ["csinc w6, w4, w5, ge"],
    body: "mov w4, 10\nmov w5, 20\ncmp w4, w5\ncsinc w6, w4, w5, ge",
    read: (m) => signed32(m.get_register(6)),
  },
  {
    slug: "predict-external-data",
    index: 0,
    uses: ["a_m:    .hword 23", "b_m:    .word 42", "c_m:    .dword 0"],
    body: "nop",
    after: "        .data\na_m:    .hword 23\nb_m:    .word 42\nc_m:    .dword 0\nend_m:\n",
    read: (m) => String(label(m, "end_m") - label(m, "a_m")),
  },
  {
    slug: "predict-external-data",
    index: 1,
    uses: ["season_m:   .dword spr_m, sum_m, fal_m, win_m"],
    body: "nop",
    after:
      '        .data\nspr_m:      .string "spring"\nsum_m:      .string "summer"\nfal_m:      .string "fall"\nwin_m:      .string "winter"\n\n        .balign 8\nseason_m:   .dword spr_m, sum_m, fal_m, win_m\n',
    read: (m) => {
      const table = label(m, "season_m");
      const at = [0, 1, 2, 3].find((i) => u64At(m, table + 8 * i) === BigInt(label(m, "fal_m")));
      return at === undefined ? "no slot holds fal_m" : hex(0x1000 + 8 * at);
    },
  },
  {
    slug: "predict-external-data",
    index: 2,
    uses: ['msg_m:  .string "Hello"'],
    body: "nop",
    after: '        .data\nmsg_m:  .string "Hello"\nend_m:\n',
    read: (m) => String(label(m, "end_m") - label(m, "msg_m")),
  },
  {
    slug: "predict-external-data",
    index: 3,
    uses: ["bump_f:", "add     w10, w10, 1"],
    body: "bl bump_f\nbl bump_f",
    after:
      "        .data\ncount_m:    .word 0\n\n        .text\n        .balign 4\nbump_f:\n        ldr     x9, =count_m\n        ldr     w10, [x9]\n        add     w10, w10, 1\n        str     w10, [x9]\n        ret\n",
    read: (m) => String(u32At(m, label(m, "count_m"))),
  },
  {
    slug: "predict-external-data",
    index: 4,
    uses: ["season_m:   .dword spr_m, sum_m, fal_m, win_m"],
    body: "nop",
    after:
      '        .data\nspr_m:      .string "spring"\nsum_m:      .string "summer"\nfal_m:      .string "fall"\nwin_m:      .string "winter"\n\n        .balign 8\nseason_m:   .dword spr_m, sum_m, fal_m, win_m\nend_m:\n',
    read: (m) => String(label(m, "end_m") - label(m, "season_m")),
  },
  {
    slug: "predict-floating-point",
    index: 0,
    uses: ["fadd s0, s1, s2"],
    body: "ldr x9, =k\nldr s1, [x9]\nldr s2, [x9, 4]\nfadd s0, s1, s2",
    after: "        .data\n        .balign 4\nk:      .word 0x40200000, 0x40600000   // 2.5, 3.5\n",
    read: (m) => fp(m, 0, true),
  },
  {
    slug: "predict-floating-point",
    index: 1,
    uses: ["fmadd d0, d1, d2, d3"],
    body: "ldr x9, =k\nldr d1, [x9]\nldr d2, [x9, 8]\nldr d3, [x9, 16]\nfmadd d0, d1, d2, d3",
    after: "        .data\n        .balign 8\nk:      .double 2.0, 3.0, 10.0\n",
    read: (m) => fp(m, 0, false),
  },
  {
    slug: "predict-floating-point",
    index: 2,
    uses: ["fabs d0, d1"],
    body: "ldr x9, =k\nldr d1, [x9]\nfabs d0, d1",
    after: "        .data\n        .balign 8\nk:      .double -42.5\n",
    read: (m) => fp(m, 0, false),
  },
  {
    slug: "predict-floating-point",
    index: 3,
    uses: ["fneg s0, s1"],
    body: "ldr x9, =k\nldr s1, [x9]\nfneg s0, s1",
    after: "        .data\n        .balign 4\nk:      .word 0x41700000   // 15.0\n",
    read: (m) => fp(m, 0, true),
  },
  {
    slug: "predict-floating-point",
    index: 4,
    uses: ["fnmul s0, s1, s2"],
    body: "ldr x9, =k\nldr s1, [x9]\nldr s2, [x9, 4]\nfnmul s0, s1, s2",
    after: "        .data\n        .balign 4\nk:      .word 0x40000000, 0x40800000   // 2.0, 4.0\n",
    read: (m) => fp(m, 0, true),
  },
  {
    slug: "predict-frame-stack",
    index: 0,
    uses: ["ldr x21, [x20, 16]!"],
    body: "ldr x20, =buf\nldr x21, [x20, 16]!",
    after: BUF,
    read: (m) => hex(0x1000n + (m.get_register(20) - BigInt(label(m, "buf")))),
  },
  {
    slug: "predict-frame-stack",
    index: 1,
    uses: ["str w20, [x28], 8"],
    body: "ldr x28, =buf\nmov w20, 0x5a\nstr w20, [x28], 8",
    after: BUF,
    read: (m) => {
      const bytes = m.get_memory_range(label(m, "buf"), 16);
      return hex(0x2000 + bytes.indexOf(0x5a));
    },
  },
  {
    slug: "predict-frame-stack",
    index: 2,
    uses: ["str w20, [x28], 8"],
    body: "ldr x28, =buf\nstr w20, [x28], 8",
    after: BUF,
    read: (m) => hex(0x2000n + (m.get_register(28) - BigInt(label(m, "buf")))),
  },
  {
    slug: "predict-frame-stack",
    index: 3,
    uses: ["ldr x22, [x29, x21, lsl 3]"],
    // Slot i of the table holds i, so the value loaded names the slot.
    body: "ldr x29, =table\nmov x21, 5\nldr x22, [x29, x21, lsl 3]",
    after: "        .data\n        .balign 8\ntable:  .dword 0, 1, 2, 3, 4, 5, 6, 7\n",
    read: (m) => String(8n * m.get_register(22)),
  },
  {
    slug: "predict-frame-stack",
    index: 4,
    uses: ["add sp, sp, -28 & -16"],
    body: "add sp, sp, -28 & -16",
    read: (m, sp) => signed64(m.get_sp() - sp),
  },
  {
    slug: "predict-frame-stack",
    index: 5,
    uses: ["str w21, [fp, c_s]"],
    // fp stands at mid instead of 0x8000; the store lands the same distance away.
    body: "fp .req x29\nc_s = -4\nldr fp, =mid\nmov w21, 10\nstr w21, [fp, c_s]",
    after: BUF,
    read: (m) => {
      const bytes = m.get_memory_range(label(m, "buf"), 128);
      return hex(0x8000 + bytes.indexOf(10) - (label(m, "mid") - label(m, "buf")));
    },
  },
  {
    slug: "predict-frame-stack",
    index: 6,
    uses: ["stp x29, x30, [sp, -(16 + 12) & -16]!"],
    body: "stp x29, x30, [sp, -(16 + 12) & -16]!",
    read: (m, sp) => String(sp - m.get_sp()),
  },
  {
    slug: "predict-frame-stack",
    index: 8,
    uses: ["ldrsb w20, [x29]"],
    body: "ldr x29, =byte\nldrsb w20, [x29]",
    after: "        .data\nbyte:   .byte 0xff\n",
    read: (m) => hex32(m.get_register(20)),
  },
  {
    slug: "predict-frame-stack",
    index: 9,
    uses: ["ldrb w20, [x29]"],
    body: "ldr x29, =byte\nldrb w20, [x29]",
    after: "        .data\nbyte:   .byte 0xff\n",
    read: (m) => hex32(m.get_register(20)),
  },
  {
    slug: "predict-functions",
    index: 0,
    uses: ["str x19, [sp, 16]", "mov w19, w0", "bl sum", "add w0, w0, w19"],
    body: "mov w0, 4\nbl sum",
    after:
      "sum:\n        stp x29, x30, [sp, -32]!\n        mov x29, sp\n        str x19, [sp, 16]\n        mov w19, w0\n        cbz w0, back\n        sub w0, w0, 1\n        bl sum\n        add w0, w0, w19\nback:\n        ldr x19, [sp, 16]\n        ldp x29, x30, [sp], 32\n        ret\n",
    read: (m) => signed32(m.get_register(0)),
  },
  {
    slug: "predict-functions",
    index: 1,
    uses: ["stp x29, x30, [sp, -32]!", "stp x19, x20, [sp, 16]"],
    // keep is called from sp rather than 0x8000; x20's marker lands the same distance below it.
    body: "mov x20, 0x5a5a\nbl keep",
    after:
      "keep:\n        stp x29, x30, [sp, -32]!\n        mov x29, sp\n        stp x19, x20, [sp, 16]\n        ldp x19, x20, [sp, 16]\n        ldp x29, x30, [sp], 32\n        ret\n",
    read: (m, sp) => {
      const below = new DataView(m.get_memory_range(Number(sp) - 64, 64).buffer);
      const slot = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => below.getBigUint64(8 * i, true) === 0x5a5an);
      return slot === undefined ? "x20 never stored" : hex(0x8000 - 64 + 8 * slot);
    },
  },
  {
    slug: "predict-functions",
    index: 2,
    uses: ["mov w19, 50", "bl triple", "mov w19, 3", "mul w0, w0, w19"],
    body: "mov w19, 50\nmov w0, 6\nbl triple\nadd w0, w0, w19",
    after: "triple:\n        mov w19, 3\n        mul w0, w0, w19\n        ret\n",
    read: (m) => signed32(m.get_register(0)),
  },
  {
    slug: "predict-functions",
    index: 3,
    uses: ["stp x29, x30, [sp, -32]!", "bl g", "stp x29, x30, [sp, -16]!"],
    // g copies [x29] into x9 right after its mov; f is called from sp rather than 0x8000.
    body: "bl f",
    after:
      "f:\n        stp x29, x30, [sp, -32]!\n        mov x29, sp\n        bl g\n        ldp x29, x30, [sp], 32\n        ret\ng:\n        stp x29, x30, [sp, -16]!\n        mov x29, sp\n        ldr x9, [x29]\n        ldp x29, x30, [sp], 16\n        ret\n",
    read: (m, sp) => hex(0x8000n + (m.get_register(9) - sp)),
  },
  {
    slug: "predict-functions",
    index: 4,
    uses: ["mov w9, w0", "bl total", "add w0, w0, w9"],
    body: "mov w0, 3\nbl total",
    after:
      "total:\n        stp x29, x30, [sp, -16]!\n        mov x29, sp\n        mov w9, w0\n        cbz w0, back\n        sub w0, w0, 1\n        bl total\n        add w0, w0, w9\nback:\n        ldp x29, x30, [sp], 16\n        ret\n",
    read: (m) => signed32(m.get_register(0)),
  },
  {
    slug: "predict-loops",
    index: 0,
    uses: ["add w20, w20, 2", "b.le body"],
    body: "mov w19, 0\nmov w20, 1\nb test\nbody:\nadd w19, w19, w20\nadd w20, w20, 2\ntest:\ncmp w20, 9\nb.le body",
    read: (m) => signed32(m.get_register(19)),
  },
  {
    slug: "predict-loops",
    index: 1,
    uses: ["mov w20, 12", "b.lt again"],
    body: "mov w19, 0\nmov w20, 12\nagain:\nadd w19, w19, 1\nadd w20, w20, 1\ncmp w20, 10\nb.lt again",
    read: (m) => signed32(m.get_register(19)),
  },
  {
    slug: "predict-loops",
    index: 2,
    uses: ["add w20, w20, 4", "b.lt body"],
    body: "mov w20, 0\nb test\nbody:\nadd w20, w20, 4\ntest:\ncmp w20, 10\nb.lt body",
    read: (m) => signed32(m.get_register(20)),
  },
  {
    slug: "predict-loops",
    index: 3,
    uses: ["b.le col_top", "b.lt row_top"],
    body: "mov w19, 0\nmov w20, 0\nrow_top:\nmov w21, 0\ncol_top:\nadd w19, w19, 1\nadd w21, w21, 1\ncmp w21, w20\nb.le col_top\nadd w20, w20, 1\ncmp w20, 4\nb.lt row_top",
    read: (m) => signed32(m.get_register(19)),
  },
  {
    slug: "predict-loops",
    index: 4,
    uses: ["mov w20, -2", "b.lo loop"],
    body: "mov w19, 0\nmov w20, -2\nloop:\nadd w19, w19, 1\nadd w20, w20, 1\ncmp w20, 2\nb.lo loop",
    read: (m) => signed32(m.get_register(19)),
  },
  {
    slug: "predict-subroutines",
    index: 0,
    uses: ["bl swap"],
    // The bl sits at `call` here rather than 0x400040; lr is the same distance past it.
    body: "call:   bl swap",
    after: "",
    read: (m) => hex(0x400040n + (m.get_register(30) - BigInt(label(m, "call")))),
  },
];

const PREDICTIONS = new Map(
  loadAllExercises()
    .filter((e): e is PredictionExercise => e.variant === "prediction")
    .map((e) => [e.slug, e.predictions]),
);

function run(row: Row, answer: string): string {
  // Two rows plug the answer itself into the code the question shows.
  const body = row.body.replace("OFFSET", answer);
  // A bl target at `done` stops the machine on the callee's first word.
  const swap = row.slug === "predict-subroutines" ? "swap:\n" : "";
  const source = [
    "        .text",
    "        .global main",
    "main:",
    ...body.split("\n").map((line) => (/^\w+:|\.req|^\w+\s*=/.test(line) ? line : `        ${line}`)),
    `${swap}done:   nop`,
    row.after ?? "",
  ].join("\n");
  const m = new Emulator();
  try {
    const asm = m.assemble_and_load_with_args(source, []) as { error?: string | null };
    if (asm.error) throw new Error(`${row.slug}[${row.index}] does not assemble: ${asm.error}\n${source}`);
    const entrySp = m.get_sp();
    m.set_breakpoint(Number(m.resolve_label("done")));
    const result = m.run_until_break(10_000) as { error?: string | null; hit_breakpoint?: boolean };
    if (!result.hit_breakpoint) throw new Error(`${row.slug}[${row.index}] never reached done: ${result.error}`);
    const shown = row.read(m, entrySp);
    return shown === "ANSWER" ? answer : shown;
  } finally {
    m.free();
  }
}

describe("prediction answers match what the machine does", () => {
  it.each(ROWS.map((row) => [`${row.slug}[${row.index}]`, row] as const))("%s", (_name, row) => {
    const question = PREDICTIONS.get(row.slug)?.[row.index];
    expect(question, "the question exists").toBeDefined();
    for (const line of row.uses) expect(question!.code, "the row runs the question's code").toContain(line);
    const shown = run(row, question!.answer);
    expect(typedAnswerIsRight([question!.answer], shown), `the machine shows ${shown}`).toBe(true);
  });

  it("runs every prediction except the ones with nothing to run", () => {
    const covered = new Set(ROWS.map((row) => `${row.slug}[${row.index}]`));
    const paperOnly = [...PREDICTIONS].flatMap(([slug, questions]) =>
      questions.map((_, index) => `${slug}[${index}]`).filter((key) => !covered.has(key)),
    );
    expect(paperOnly.sort()).toEqual(
      [
        "predict-armv8[3]", // which flag b.eq reads
        "predict-arrays[0]", // bytes an int[5] needs
        "predict-arrays[3]", // bytes an int[2][3][3] needs
        "predict-frame-stack[7]", // pad bytes a frame leaves
        "predict-subroutines[1]", // stack space for ten int arguments
        "predict-subroutines[2]", // a leaf function's frame
        "predict-subroutines[3]", // the register that carries a returned struct's address
      ].sort(),
    );
  });
});
