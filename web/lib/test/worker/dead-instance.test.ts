import { describe, expect, it } from "vitest";

import { isDeadInstance } from "@/lib/worker/dead-instance";

/**
 * The worker's fatal-error classifier, pinned directly. It sits in its own
 * module because the worker entry cannot be imported under vitest (it calls
 * `self.addEventListener` at module scope and pulls in the generated wasm
 * glue by a literal relative URL the bundler pins), and this rule is
 * expensive to get wrong in EITHER direction -- too eager and a student
 * loses their registers, console and VFS to a typo; too shy and one trap
 * wedges the playground until a page reload.
 */
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
      "assembly error at line 3: unknown mnemonic: MOVE",
      "link error at line 0: no entry point -- define `main:`",
      "preprocess error at line 1: malformed m4 define",
      "immediate out of range (0-4095)",
      "emulator not initialized; send `init` first",
      "unknown request kind: {}",
    ]) {
      expect(isDeadInstance(new Error(message)), message).toBe(false);
    }
  });
});
