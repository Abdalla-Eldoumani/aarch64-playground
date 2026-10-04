// @vitest-environment node
// The reference's flag panels compute NZCV in JavaScript so a student can
// try operands without a machine. This holds that second implementation to
// the emulator itself: the same operands go through subs, adds, ands and
// fcmp on the node build, and the flags must agree bit for bit.
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { computeFcmpFlags, computeIntFlags, type Flags, type IntOp } from "@/lib/emulator/flag-math";

const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

/** NZCV as the emulator packs it: N in bit 3 down to V in bit 0. */
const packed = (f: Flags) => (+f.n << 3) | (+f.z << 2) | (+f.c << 1) | +f.v;

/** Run `lines` from main and hand back NZCV where `done` sits. */
function machineFlags(lines: string[], data = ""): number {
  const source = [
    "        .text",
    "        .global main",
    "main:",
    ...lines.map((line) => `        ${line}`),
    "done:   nop",
    data,
  ].join("\n");
  const emu = new Emulator();
  try {
    const asm = emu.assemble_and_load_with_args(source, []) as { error?: string | null };
    if (asm.error) throw new Error(`${asm.error}\n${source}`);
    emu.set_breakpoint(Number(emu.resolve_label("done")));
    emu.run_until_break(1_000);
    return emu.get_nzcv();
  } finally {
    emu.free();
  }
}

const hex64 = (v: bigint) => `0x${BigInt.asUintN(64, v).toString(16)}`;

// The boundaries where the four flags change their minds, at both widths.
const OPERANDS = [
  0n,
  1n,
  -1n,
  5n,
  0x7fffffffn,
  0x80000000n,
  0xffffffffn,
  0x100000000n,
  0x7fffffffffffffffn,
  -0x8000000000000000n,
];
const MNEMONIC: Record<IntOp, string> = { sub: "subs", add: "adds", and: "ands" };

describe("the flag panels' integer arithmetic matches the machine", () => {
  for (const bits of [32, 64] as const) {
    for (const op of ["sub", "add", "and"] as const) {
      it(`${MNEMONIC[op]} at ${bits} bits`, () => {
        const r = bits === 32 ? "w" : "x";
        const wrong: string[] = [];
        for (const a of OPERANDS) {
          for (const b of OPERANDS) {
            const machine = machineFlags([
              `ldr x1, =${hex64(a)}`,
              `ldr x2, =${hex64(b)}`,
              `${MNEMONIC[op]} ${r}0, ${r}1, ${r}2`,
            ]);
            const panel = packed(computeIntFlags(op, a, b, bits).flags);
            if (panel !== machine) {
              wrong.push(`${hex64(a)} ${op} ${hex64(b)}: panel ${panel.toString(2)}, machine ${machine.toString(2)}`);
            }
          }
        }
        expect(wrong).toEqual([]);
      });
    }
  }
});

describe("the flag panels' fcmp matches the machine", () => {
  const VALUES: Array<[string, number]> = [
    ["0.0", 0],
    ["-0.0", -0],
    ["1.5", 1.5],
    ["-2.0", -2],
    ["inf", Infinity],
    ["-inf", -Infinity],
    ["nan", NaN],
  ];

  it("agrees on every ordered and unordered pair, signed zeros included", () => {
    const wrong: string[] = [];
    for (const [aName, a] of VALUES) {
      for (const [bName, b] of VALUES) {
        const view = new DataView(new ArrayBuffer(16));
        view.setFloat64(0, a, true);
        view.setFloat64(8, b, true);
        const words = [view.getBigUint64(0, true), view.getBigUint64(8, true)].map(hex64);
        const machine = machineFlags(
          ["ldr x9, =pair", "ldr d1, [x9]", "ldr d2, [x9, 8]", "fcmp d1, d2"],
          `        .data\n        .balign 8\npair:   .dword ${words.join(", ")}\n`,
        );
        const panel = packed(computeFcmpFlags(a, b));
        if (panel !== machine) wrong.push(`${aName} vs ${bName}: panel ${panel}, machine ${machine}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
