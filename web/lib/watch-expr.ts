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
 *   `arr[3]`              8-byte memory at (label `arr` address) + 3*8
 *   `arr[i]` / `arr[w3]`  same with i read from a register (wN only)
 *
 * The parser is deliberately minimal; unsupported syntax returns a
 * descriptive error rather than throwing.
 */

export interface EvalContext {
  readRegister: (name: string) => bigint | null;
  readMemory: (addr: bigint, size: number) => bigint | null;
  resolveSymbol: (name: string) => bigint | null;
}

export interface EvalOk {
  value: bigint;
  size: number;
  display: string;
}

export type EvalOutcome = EvalOk | { error: string };

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
    if ("error" in innerResult) return innerResult;
    const addr = innerResult.value;
    const size = 8;
    const v = ctx.readMemory(addr, size);
    if (v == null) return { error: `fault reading ${toHex(addr, 8)}` };
    return { value: v, size, display: toHex(v, size) };
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const body = trimmed.slice(1, -1);
    const parts = body.split(",").map((s) => s.trim());
    if (parts.length !== 2) return { error: "expected [reg, offset]" };
    const regVal = ctx.readRegister(parts[0].toLowerCase());
    if (regVal == null) return { error: `unknown register ${parts[0]}` };
    const offset = parseOffset(parts[1], ctx);
    if (offset == null) return { error: `unknown offset ${parts[1]}` };
    const addr = regVal + offset;
    const v = ctx.readMemory(addr, 8);
    if (v == null) return { error: `fault reading ${toHex(addr, 8)}` };
    return { value: v, size: 8, display: toHex(v, 8) };
  }

  const arrayMatch = /^([A-Za-z_][A-Za-z0-9_]*)\[([^\]]+)\]$/.exec(trimmed);
  if (arrayMatch) {
    const name = arrayMatch[1];
    const index = arrayMatch[2].trim();
    const base = ctx.resolveSymbol(name);
    if (base == null) return { error: `unknown symbol ${name}` };
    const idx = parseOffset(index, ctx);
    if (idx == null) return { error: `unknown index ${index}` };
    const addr = base + idx * 8n;
    const v = ctx.readMemory(addr, 8);
    if (v == null) return { error: `fault reading ${toHex(addr, 8)}` };
    return { value: v, size: 8, display: toHex(v, 8) };
  }

  return { error: "unsupported expression" };
}

function parseOffset(s: string, ctx: EvalContext): bigint | null {
  const t = s.trim();
  if (t.startsWith("0x") || t.startsWith("0X")) return BigInt(t);
  if (/^-?\d+$/.test(t)) return BigInt(t);
  const reg = regName(t);
  if (reg) {
    const v = ctx.readRegister(reg);
    if (v != null) return v;
  }
  const sym = ctx.resolveSymbol(t);
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
  const mask = size === 4 ? 0xFFFFFFFFn : 0xFFFFFFFFFFFFFFFFn;
  const width = size === 4 ? 8 : 16;
  const unsigned = v & mask;
  return "0x" + unsigned.toString(16).padStart(width, "0");
}
