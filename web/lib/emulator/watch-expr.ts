/**
 * Tiny watch-expression evaluator. Supports a narrow grammar aimed at
 * cpsc 355 student usage:
 *
 *   `x0`                  read a register
 *   `w3`                  low 32 bits of X3
 *   `*x0`                 8-byte memory at X0
 *   `*w0`                 4-byte memory at W0 (zero-extended)
 *   `[fp, score1_s]`      8-byte memory at X29 + alias offset
 *   `[fp, 16]`            same with a literal offset
 *   `[x0, 4]`             same with any base register
 *   `arr[3]`              element 3 of the data label `arr`, sized by the
 *                         directive after the label (.byte 1 ... .dword 8),
 *                         or 8-byte memory at fp + slot offset + 3*8 for a
 *                         frame slot
 *   `arr[i]` / `arr[w3]`  same with i read from a register (wN only)
 *
 * Unsupported syntax returns an error rather than throwing.
 */

/** A memory read is three-valued: bytes, a definite fault, or a verdict
 *  still in flight (the panel reads a sync view over an async cache). */
export type MemRead = bigint | "unmapped" | "pending";

export interface EvalContext {
  readRegister: (name: string) => bigint | null;
  readMemory: (addr: bigint, size: number) => MemRead;
  /** `name = value` frame-slot offset, for `[reg, name]`. */
  resolveSlotOffset: (name: string) => bigint | null;
  /** Absolute address of a data label, for `arr[i]`. Kept apart from
   * `resolveSlotOffset`: a frame-slot OFFSET dereferenced as an absolute
   * address reads zero from low memory. "pending" while the lookup is in
   * flight. */
  resolveLabelAddress: (name: string) => bigint | "pending" | null;
  /** Element size of a data label (see `labelElementSize`). Left out, every
   * label array is refused: a guessed stride reads the wrong element. */
  labelElementSize?: (name: string) => ElementSize;
}

export type ElementSize = { size: number } | { error: string };

export interface EvalOk {
  value: bigint;
  size: number;
  display: string;
}

export type EvalOutcome = EvalOk | { error: string } | { pending: true };

export function evaluateWatch(expr: string, ctx: EvalContext): EvalOutcome {
  const trimmed = expr.trim();
  if (trimmed.length === 0) return { error: "empty expression" };

  const regOnly = regName(trimmed);
  if (regOnly) {
    const v = ctx.readRegister(regOnly);
    if (v == null) return { error: `unknown register ${regOnly}` };
    const sized = sizeFor(regOnly, v);
    return {
      value: sized,
      size: regWidth(regOnly),
      display: toHex(sized, regWidth(regOnly)),
    };
  }

  if (trimmed.startsWith("*")) {
    const inner = trimmed.slice(1).trim();
    const innerResult = evaluateWatch(inner, ctx);
    if ("error" in innerResult || "pending" in innerResult) return innerResult;
    const addr = innerResult.value;
    // The deref width follows the inner expression: *x0 reads a quad,
    // *w0 reads a word, the 4-byte view students want for .word data.
    const size = innerResult.size;
    return readAt(ctx, addr, size);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const body = trimmed.slice(1, -1);
    const parts = body.split(",").map((s) => s.trim());
    if (parts.length !== 2) return { error: "expected [reg, offset]" };
    const regVal = ctx.readRegister(parts[0].toLowerCase());
    if (regVal == null) return { error: `unknown register ${parts[0]}` };
    const offset = parseOffset(parts[1], ctx);
    if (offset == null) return { error: `unknown offset ${parts[1]}` };
    return readAt(ctx, regVal + offset, 8);
  }

  const arrayMatch = ARRAY_FORM.exec(trimmed);
  if (arrayMatch) {
    const name = arrayMatch[1];
    const index = arrayMatch[2].trim();
    const idx = parseOffset(index, ctx);
    if (idx == null) return { error: `unknown index ${index}` };
    const label = ctx.resolveLabelAddress(name);
    if (label === "pending") return { pending: true };
    if (label != null) {
      const element = ctx.labelElementSize?.(name) ?? { error: "no source to read" };
      if ("error" in element) {
        return { error: `can't tell the element size of ${name}: ${element.error}` };
      }
      return readAt(ctx, label + idx * BigInt(element.size), element.size);
    }
    // A frame-slot name is an OFFSET from fp, never an address; resolve
    // it against the live frame pointer so `a_s[0]` reads the array on
    // the stack instead of dereferencing the offset as low memory.
    const slot = ctx.resolveSlotOffset(name);
    if (slot != null) {
      const fp = ctx.readRegister("fp");
      if (fp == null) return { error: "fp is not available" };
      return readAt(ctx, fp + slot + idx * 8n, 8);
    }
    return { error: `unknown symbol ${name}` };
  }

  return { error: "unsupported expression" };
}

function readAt(ctx: EvalContext, addr: bigint, size: number): EvalOutcome {
  const v = ctx.readMemory(addr, size);
  if (v === "unmapped") return { error: `fault reading ${toHex(addr, 8)}` };
  if (v === "pending") return { pending: true };
  return { value: v, size, display: toHex(v, size) };
}

function parseOffset(s: string, ctx: EvalContext): bigint | null {
  const t = s.trim();
  // Validate before BigInt: `BigInt("0xZZ")` THROWS, and an unguarded throw
  // here white-screens the whole playground on a malformed watch offset.
  if (t.startsWith("0x") || t.startsWith("0X")) {
    return /^[0-9a-f]+$/i.test(t.slice(2)) ? BigInt(t) : null;
  }
  if (/^-?\d+$/.test(t)) return BigInt(t);
  const reg = regName(t);
  if (reg) {
    const v = ctx.readRegister(reg);
    if (v != null) return v;
  }
  const sym = ctx.resolveSlotOffset(t);
  if (sym != null) return sym;
  return null;
}

function regName(s: string): string | null {
  const t = s.trim().toLowerCase();
  if (t === "sp" || t === "fp" || t === "lr" || t === "xzr" || t === "wzr") return t;
  if (/^[xw]\d+$/.test(t)) return t;
  return null;
}

function regWidth(name: string): number {
  if (name.startsWith("w")) return 4;
  return 8;
}

function sizeFor(name: string, v: bigint): bigint {
  if (name.startsWith("w")) return v & 0xFFFFFFFFn;
  return v;
}

function toHex(v: bigint, size: number): string {
  const unsigned = v & ((1n << BigInt(size * 8)) - 1n);
  return "0x" + unsigned.toString(16).padStart(size * 2, "0");
}

const ARRAY_FORM = /^([A-Za-z_][A-Za-z0-9_]*)\[([^\]]+)\]$/;

/** The label an `arr[i]` watch names, so the panel knows what to look up. */
export function watchLabelName(expr: string): string | null {
  return ARRAY_FORM.exec(expr.trim())?.[1] ?? null;
}

const DATA_SIZES = new Map<string, number>([
  [".byte", 1], [".1byte", 1],
  [".hword", 2], [".short", 2], [".2byte", 2],
  [".word", 4], [".int", 4], [".long", 4], [".4byte", 4], [".single", 4], [".float", 4],
  [".dword", 8], [".quad", 8], [".xword", 8], [".8byte", 8], [".double", 8],
]);
// Data with no element size of its own.
const UNSIZED_DATA = new Set([".ascii", ".asciz", ".string", ".skip", ".space", ".zero", ".fill"]);
const LEADING_LABEL = /^\s*([A-Za-z_.$][\w.$]*|\d+)\s*:/;

/**
 * The element size of data label `name` (an identifier), read from the
 * source: the directive right after `name:`, and every data directive under
 * it up to the next label, instruction or other directive, must agree.
 * Anything less certain is an error, because a guessed size points the
 * watch at the wrong element.
 */
export function labelElementSize(source: string, name: string): ElementSize {
  if (new RegExp(`define\\(\\s*\`?${name}'?\\s*,`).test(source)) {
    return { error: "m4 defines it" };
  }
  const statements = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .flatMap((line) => line.replace(/\/\/.*$/, "").split(";"));
  let state: "before" | "in" | "after" = "before";
  let defined = 0;
  let unsized = false;
  const sizes = new Set<number>();
  for (const statement of statements) {
    let rest = statement;
    const labels: string[] = [];
    for (let m = LEADING_LABEL.exec(rest); m; m = LEADING_LABEL.exec(rest)) {
      labels.push(m[1]);
      rest = rest.slice(m[0].length);
    }
    if (labels.includes(name) && ++defined > 1) return { error: "its label appears twice" };
    if (state === "before" && labels.includes(name)) state = "in";
    // A label before any data shares the address; one after it ends the block.
    else if (state === "in" && labels.length > 0 && (sizes.size > 0 || unsized)) state = "after";
    if (state !== "in") continue;
    const directive = rest.trim().split(/\s/)[0].toLowerCase();
    if (directive === "") continue;
    const size = DATA_SIZES.get(directive);
    if (size !== undefined) sizes.add(size);
    else if (UNSIZED_DATA.has(directive)) unsized = true;
    else state = "after";
  }
  if (defined === 0) return { error: "its label is not in the source" };
  if (sizes.size === 0) return { error: "no .byte, .hword, .word or .dword after its label" };
  if (sizes.size > 1 || unsized) return { error: "its label mixes data sizes" };
  return { size: [...sizes][0] };
}
