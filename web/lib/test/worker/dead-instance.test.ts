import { describe, expect, it } from "vitest";

import { isDeadInstance } from "@/lib/worker/dead-instance";

// Wrong in either direction costs a student: too eager and a typo throws away
// their registers, console and files; too shy and one wasm trap leaves the
// playground stuck until a page reload.
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
