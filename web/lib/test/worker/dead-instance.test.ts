import { describe, expect, it } from "vitest";

import { isDeadInstance } from "@/lib/worker/dead-instance";

// The rule alone (emulator.worker.test.ts checks the rebuild it triggers): a
// trap, or the borrow guard a trap leaves stuck, marks the instance dead, and
// ordinary error messages do not. Too eager and the worker discards a working
// machine; too shy and one trap leaves the playground stuck until a reload.
describe("worker fatal-error classification", () => {
  it("treats a latched borrow guard and a trap as unusable", () => {
    // wasm-bindgen's guard after a trap skipped its Drop
    expect(
      isDeadInstance(
        new Error(
          "recursive use of an object detected which would lead to unsafe aliasing in Rust",
        ),
      ),
    ).toBe(true);
    expect(isDeadInstance(new Error("already borrowed"))).toBe(true);
    expect(isDeadInstance(new Error("null pointer passed to rust"))).toBe(true);
    expect(isDeadInstance(new Error("unreachable executed"))).toBe(true);
    expect(isDeadInstance(new WebAssembly.RuntimeError("trap"))).toBe(true);
  });

  it("leaves the machine alone for the diagnostics students see every day", () => {
    // These arrive through the same catch. Dropping the instance for one
    // of them would throw away the session on an ordinary mistake.
    for (const message of [
      "assembly error at line 3: unknown mnemonic `MOVE`: check the spelling",
      "link error at line 0: no entry point. Define `main:`",
      "preprocess error at line 1: malformed m4 define",
      "immediate out of range (0-4095)",
      "emulator not initialized; send `init` first",
      "unknown request kind: {}",
    ]) {
      expect(isDeadInstance(new Error(message)), message).toBe(false);
    }
  });
});
