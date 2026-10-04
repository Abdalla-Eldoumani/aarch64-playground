// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { DATA_DIRECTIVES } from "@/lib/content/directives-reference";

// The reference's data directive examples, assembled by the real emulator:
// every line must assemble, and each must lay down the bytes the table says.
// A label after each example marks where it ends, so the size is the gap.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

const SIZES: Record<string, number> = {
  flags: 3,
  ages: 4,
  scores: 12,
  big: 8,
  g: 4,
  rate: 8,
  fmt: 4,
  tag: 2,
  buffer: 256,
};

function program(): string {
  const lines = (keep: (d: (typeof DATA_DIRECTIVES)[number]) => boolean) =>
    DATA_DIRECTIVES.filter(keep).flatMap((d) => {
      const label = d.example.slice(0, d.example.indexOf(":"));
      return [d.example, `${label}_end:`];
    });
  return [
    ".data",
    ...lines((d) => d.directive !== ".skip"),
    ".bss",
    ...lines((d) => d.directive === ".skip"),
    ".text",
    "        .balign 4",
    "        .global main",
    "main:",
    "        mov     w0, 0",
    "        ret",
    "",
  ].join("\n");
}

describe("the directives reference", () => {
  it("lists one example per directive, labelled the way the sizes below name them", () => {
    expect(DATA_DIRECTIVES.map((d) => d.example.slice(0, d.example.indexOf(":")))).toEqual(Object.keys(SIZES));
  });

  it("assembles every example, each taking the bytes its row says", () => {
    const emu = new Emulator();
    try {
      const asm = emu.assemble_and_load_with_args(program(), []) as { error?: string | null };
      expect(asm.error ?? null).toBeNull();
      for (const [label, size] of Object.entries(SIZES)) {
        const start = emu.resolve_label(label);
        const end = emu.resolve_label(`${label}_end`);
        expect(start, label).toBeDefined();
        expect(Number(end! - start!), label).toBe(size);
      }
    } finally {
      emu.free();
    }
  });
});
