import { describe, expect, it } from "vitest";

/**
 * The worker's fatal-error classifier, restated here.
 *
 * The worker module itself cannot be imported under vitest: it calls
 * `self.addEventListener` at module scope and pulls in the generated wasm
 * glue by a literal relative URL that the bundler pins. The rule it
 * encodes is small and worth pinning on its own, because getting it wrong
 * in EITHER direction is expensive -- too eager and a student loses their
 * registers, console and VFS to a typo; too shy and one trap wedges the
 * playground until a page reload.
 *
 * Keep in lockstep with `isDeadInstance` in lib/worker/emulator.worker.ts.
 */
function isDeadInstance(e: unknown): boolean {
  if (typeof WebAssembly !== "undefined" && e instanceof WebAssembly.RuntimeError) {
    return true;
  }
  const message = e instanceof Error ? e.message : String(e);
  return (
    message.includes("recursive use of an object") ||
    message.includes("already borrowed") ||
    message.includes("null pointer passed to rust") ||
    message.includes("unreachable executed")
  );
}

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
