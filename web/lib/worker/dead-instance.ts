/**
 * Whether an error means the wasm instance is unusable from here on.
 *
 * Assemble and runtime diagnostics arrive through the worker's one catch
 * and are entirely normal -- treating those as fatal would throw away the
 * student's registers, console and VFS on a typo. Only the signatures that
 * mean the guard is latched or the module trapped count: a wasm trap skips
 * wasm-bindgen's borrow-guard Drop, so the guard stays latched and every
 * later call throws on it.
 *
 * It lives beside the worker rather than inside it because the worker entry
 * cannot be imported under vitest (module-scope `self.addEventListener`, and
 * a wasm glue import the bundler pins by literal URL), and this rule is
 * expensive to get wrong in either direction.
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
