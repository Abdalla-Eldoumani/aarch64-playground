/**
 * Whether an error leaves the wasm instance unusable. Assemble and runtime
 * errors are normal and must not wipe the student's state on a typo; only a
 * trap counts, or the borrow guard it leaves stuck: a trap skips wasm-bindgen's
 * borrow-guard cleanup, so every later call fails on it. Kept outside the
 * worker so the rule is tested on its own, apart from the worker's message
 * handling.
 */
export function isDeadInstance(e: unknown): boolean {
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
