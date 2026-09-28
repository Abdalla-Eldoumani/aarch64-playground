// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { playgroundSource } from "@/lib/playground/playground-source";

// The reference's examples say in a comment what a line leaves in a
// register (`// x12 = 100 + 6 * 7 = 142`). Each such claim is checked here
// against the real emulator, right after the line runs the first time. A
// claim whose value is prose (`// x1 = address of the label below`) is left
// to the reader.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

interface Claim {
  w: boolean;
  reg: number;
  value: bigint;
  text: string;
}

/**
 * The register and number a comment claims. The number is the last one in a
 * chain like `~0 = -1` or `0x41 = 65`, read up to the first colon or comma.
 */
function parseClaim(line: string): Claim | null {
  const m = /\/\/\s*([xw])(\d{1,2})\s*=(?!=)([^:,;]*)/.exec(line);
  if (!m) return null;
  const last = m[3].split("=").at(-1)!.trim();
  if (!/^-?(?:0x[0-9a-f]+|\d+)$/i.test(last)) return null;
  const value = last.startsWith("-") ? -BigInt(last.slice(1)) : BigInt(last);
  return { w: m[1] === "w", reg: Number(m[2]), value, text: line.trim() };
}

/** Compare as the register holds it: 32 bits for a w name, 64 for an x. */
const asHeld = (w: boolean, v: bigint) => (w ? BigInt.asUintN(32, v) : BigInt.asUintN(64, v));

describe("reading a value claim", () => {
  it("takes the last number of a chain and stops at the explanation", () => {
    expect(parseClaim("movn x9, 0 // x9 = ~0 = -1, all ones")?.value).toBe(-1n);
    expect(parseClaim("madd x12, x9, x10, x11 // x12 = 100 + 6 * 7 = 142")?.value).toBe(142n);
    expect(parseClaim("umull x11, w9, w10 // x11 = 0x1fffffffe: no 32-bit wrap")?.value).toBe(
      0x1fffffffen,
    );
    expect(parseClaim("ldrb w10, [sp, 8] // w10 = 0x41 = 65")).toMatchObject({ w: true, reg: 10, value: 65n });
  });

  it("leaves prose and comparisons alone", () => {
    expect(parseClaim("adr x1, target // x1 = address of the label below")).toBeNull();
    expect(parseClaim("cbz w0, done // w0 == 0, so branch to done")).toBeNull();
    expect(parseClaim("lsl w10, w0, 1 // w10 = w0 * 2")).toBeNull();
  });
});

describe("the reference's value claims match the machine", () => {
  it("holds every claimed register value where its line runs", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const inst of REFERENCE_INSTRUCTIONS) {
      const source = playgroundSource(inst);
      const claims = new Map<number, Claim>();
      source.split("\n").forEach((line, i) => {
        const claim = parseClaim(line);
        if (claim) claims.set(i + 1, claim);
      });
      if (claims.size === 0) continue;

      const emu = new Emulator();
      emu.assemble_and_load_with_args(source, []);
      const map = Array.from(emu.get_line_map());
      const lineAt = new Map<number, number>();
      for (let i = 0; i + 1 < map.length; i += 2) lineAt.set(map[i], map[i + 1]);
      const pending = new Map(claims);
      for (let step = 0; step < 20_000 && pending.size > 0 && !emu.is_halted(); step++) {
        const line = lineAt.get(Number(emu.get_pc()));
        const result = emu.step() as { error?: string | null };
        const claim = line === undefined ? undefined : pending.get(line);
        if (claim) {
          pending.delete(line!);
          checked++;
          const held = asHeld(claim.w, BigInt(emu.get_register(claim.reg)));
          if (held !== asHeld(claim.w, claim.value)) {
            wrong.push(`${inst.mnemonic}: ${claim.text} (the machine holds 0x${held.toString(16)})`);
          }
        }
        if (result.error) break;
      }
      for (const claim of pending.values()) wrong.push(`${inst.mnemonic}: never ran ${claim.text}`);
    }
    expect(wrong, "claims the emulator contradicts").toEqual([]);
    // A parser that stopped matching would pass the loop above by checking nothing.
    expect(checked).toBeGreaterThan(100);
  });
});
