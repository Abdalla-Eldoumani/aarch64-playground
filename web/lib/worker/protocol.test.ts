import { describe, expect, test } from "vitest";
import { emptyStateSnapshot } from "@/lib/worker/protocol";

describe("emptyStateSnapshot", () => {
  test("carries the full 31-register file so the cold panel never collapses to SP/PC", () => {
    const snap = emptyStateSnapshot();
    // The regression this guards: a worker init snapshot with an empty
    // registers array wrote over the hook's 31-zero default, so the cold
    // register panel rendered only the hardcoded SP and PC rows.
    expect(snap.registers).toHaveLength(31);
    expect(snap.registers.every((r) => r === "0x0000000000000000")).toBe(true);
  });

  test("reports the reset stack pointer and the code-base program counter", () => {
    const snap = emptyStateSnapshot();
    expect(snap.sp).toBe("0x0000000080000000");
    // The honest entry pc, the same value the panel shows right after a
    // successful assemble, not a bare 0x0.
    expect(snap.pc).toBe("0x0000000000400000");
  });

  test("threads the frame counter and defaults to frame 0", () => {
    expect(emptyStateSnapshot().frame).toBe(0);
    expect(emptyStateSnapshot(7).frame).toBe(7);
  });

  test("starts with no output, no exit, and clean trace buffers", () => {
    const snap = emptyStateSnapshot();
    expect(snap.stdoutDelta).toBe("");
    expect(snap.stderrDelta).toBe("");
    expect(snap.exitCode).toBeNull();
    expect(snap.halted).toBe(false);
    expect(snap.blocked).toBe(false);
    expect(snap.canStepBack).toBe(false);
    expect(snap.changedRegs).toEqual([]);
    expect(snap.dirtyAddrs).toEqual([]);
    expect(snap.vfsFiles).toEqual([]);
    expect(snap.savedStates).toEqual([]);
  });
});
