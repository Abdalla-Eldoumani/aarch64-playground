import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect } from "vitest";
import type { EmulatorState } from "@/lib/emulator/emulator-state";

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");

const hex = (v: bigint | number) => `0x${BigInt(v).toString(16).padStart(16, "0")}`;

/**
 * A node-build machine on a program file (a path under web/), run to the
 * instruction on the one line holding `text`, `times` hits over; `state()`
 * is the machine as the hub would hand it to the register panel and the
 * frames view at that point. Free `emu` when the test is done.
 */
export function nodeMachine(file: string, stdin?: string) {
  const source = readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");
  const emu = new Emulator();
  expect((emu.assemble_and_load(source) as { error?: string | null }).error ?? null).toBeNull();
  if (stdin) emu.push_stdin(stdin);
  const map = Array.from(emu.get_line_map());
  const pcOf = (text: string) => {
    const lines = source.split("\n").flatMap((l, i) => (l.includes(text) ? [i + 1] : []));
    expect(lines, `"${text}" should be on exactly one line`).toHaveLength(1);
    for (let i = 0; i + 1 < map.length; i += 2) if (map[i + 1] === lines[0]) return map[i];
    throw new Error(`no instruction on line ${lines[0]}`);
  };
  const runTo = (text: string, times = 1) => {
    const pc = pcOf(text);
    emu.set_breakpoint(pc);
    for (let i = 0; i < times; i++) {
      if (i > 0 || Number(emu.get_pc()) === pc) emu.step();
      emu.run_until_break(100_000);
    }
    emu.clear_breakpoint(pc);
    expect(Number(emu.get_pc())).toBe(pc);
  };
  const state = (): Pick<EmulatorState, "registers" | "sp" | "pc" | "frames" | "frameLayout" | "getMemory"> => ({
    registers: Array.from({ length: 31 }, (_, i) => hex(emu.get_register(i))),
    sp: hex(emu.get_sp()),
    pc: Number(emu.get_pc()),
    frames: Array.from(emu.frames()),
    frameLayout: { numbers: Array.from(emu.frame_layout()), names: emu.frame_names() },
    getMemory: (addr, len) => emu.get_memory_range(addr, len),
  });
  return { emu, runTo, state };
}
