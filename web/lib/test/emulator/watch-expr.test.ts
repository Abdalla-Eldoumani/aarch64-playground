import { describe, expect, it } from "vitest";
import { evaluateWatch, type EvalContext } from "@/lib/emulator/watch-expr";

function memory(seed: Record<string, bigint>): (addr: bigint, size: number) => bigint | null {
  return (addr) => {
    const key = `0x${addr.toString(16)}`;
    return seed[key] ?? null;
  };
}

const baseCtx: EvalContext = {
  readRegister: (name) => {
    const map: Record<string, bigint> = {
      x0: 0x0070_0000n,
      x1: 0x1234n,
      w0: 0xFFFF_FFFF_0000_00ABn,
      fp: 0x8000_0000n,
      sp: 0x8000_0000n,
      lr: 0x0040_1234n,
    };
    return map[name] ?? null;
  },
  readMemory: memory({
    "0x700000": 0xDEAD_BEEFn,
    "0x80000010": 0x42n,
    "0x700008": 99n,
    "0x700010": 199n,
    "0x700018": 299n,
  }),
  resolveSymbol: (name) => {
    if (name === "arr") return 0x0070_0000n;
    if (name === "score1_s") return 16n;
    return null;
  },
};

describe("watch expressions", () => {
  it("reads a full X register", () => {
    const r = evaluateWatch("x0", baseCtx);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.display).toBe("0x0000000000700000");
    expect(r.size).toBe(8);
  });

  it("masks a W register to 32 bits", () => {
    const r = evaluateWatch("w0", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x000000ab");
    expect(r.size).toBe(4);
  });

  it("dereferences a pointer register", () => {
    const r = evaluateWatch("*x0", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x00000000deadbeef");
  });

  it("reads [reg, literal] memory", () => {
    const r = evaluateWatch("[fp, 16]", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x0000000000000042");
  });

  it("reads [reg, alias]", () => {
    const r = evaluateWatch("[fp, score1_s]", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x0000000000000042");
  });

  it("reads array index", () => {
    const r = evaluateWatch("arr[2]", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x00000000000000c7");
  });

  it("reports unknown register clearly", () => {
    const r = evaluateWatch("[x99, 0]", baseCtx);
    expect("error" in r).toBe(true);
  });

  it("reports unknown symbol clearly", () => {
    const r = evaluateWatch("nothere[0]", baseCtx);
    expect("error" in r).toBe(true);
  });
});

// Edge cases: the parser promises a descriptive error for anything outside
// the narrow grammar, and faults surface as errors rather than throws. Each
// case builds only the context it needs.

describe("watch expression edge cases", () => {
  it("reports empty and whitespace-only expressions", () => {
    expect(evaluateWatch("", baseCtx)).toEqual({ error: "empty expression" });
    expect(evaluateWatch("   ", baseCtx)).toEqual({ error: "empty expression" });
  });

  it("rejects unsupported syntax with a calm error, never a throw", () => {
    for (const expr of ["x0 + x1", "(x0)", "arr[", "1234", "score1_s"]) {
      expect(evaluateWatch(expr, baseCtx)).toEqual({ error: "unsupported expression" });
    }
  });

  it("rejects bracket forms that are not exactly [reg, offset]", () => {
    expect(evaluateWatch("[fp]", baseCtx)).toEqual({ error: "expected [reg, offset]" });
    expect(evaluateWatch("[fp, 1, 2]", baseCtx)).toEqual({ error: "expected [reg, offset]" });
  });

  it("a bare * recurses into an empty inner expression", () => {
    expect(evaluateWatch("*", baseCtx)).toEqual({ error: "empty expression" });
  });

  it("reports an unknown bare register by name", () => {
    expect(evaluateWatch("x99", baseCtx)).toEqual({ error: "unknown register x99" });
  });

  it("*deref of a null pointer reports the faulting address", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "x1" ? 0n : null),
      readMemory: () => null,
      resolveSymbol: () => null,
    };
    expect(evaluateWatch("*x1", ctx)).toEqual({ error: "fault reading 0x0000000000000000" });
  });

  it("[fp, name] against a missing frame label reports the unknown offset", () => {
    expect(evaluateWatch("[fp, nothere_s]", baseCtx)).toEqual({
      error: "unknown offset nothere_s",
    });
  });

  it("arr[i] past the seeded memory reports a fault at base + i*8", () => {
    // arr resolves to 0x700000; index 5 lands at 0x700028, which the seeded
    // memory does not cover.
    expect(evaluateWatch("arr[5]", baseCtx)).toEqual({
      error: "fault reading 0x0000000000700028",
    });
  });

  it("arr[reg] reads the index from a register", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "w2" ? 2n : null),
      readMemory: (addr) => (addr === 0x700010n ? 77n : null),
      resolveSymbol: (name) => (name === "arr" ? 0x700000n : null),
    };
    const r = evaluateWatch("arr[w2]", ctx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x000000000000004d");
  });

  it("accepts a negative literal offset in [reg, offset]", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "sp" ? 0x8000_0000n : null),
      readMemory: (addr) => (addr === 0x7fff_fff0n ? 7n : null),
      resolveSymbol: () => null,
    };
    const r = evaluateWatch("[sp, -16]", ctx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x0000000000000007");
  });

  it("accepts a hex literal offset in [reg, offset]", () => {
    const r = evaluateWatch("[fp, 0x10]", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x0000000000000042");
  });

  it("tolerates surrounding whitespace and uppercase register names", () => {
    const r = evaluateWatch("  X1  ", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x0000000000001234");
  });

  it("reads lr like any named register", () => {
    const r = evaluateWatch("lr", baseCtx);
    if ("error" in r) throw new Error(r.error);
    expect(r.display).toBe("0x0000000000401234");
    expect(r.size).toBe(8);
  });

  it("*w0 dereferences the 32-bit-masked address and reads 8 bytes", () => {
    // w0's raw backing is 0xffffffff000000ab; the W read masks the address
    // to 0xab, and the deref itself is always an 8-byte load.
    const ctx: EvalContext = {
      readRegister: (name) => (name === "w0" ? 0xffff_ffff_0000_00abn : null),
      readMemory: (addr, size) => (addr === 0xabn && size === 8 ? 5n : null),
      resolveSymbol: () => null,
    };
    const r = evaluateWatch("*w0", ctx);
    if ("error" in r) throw new Error(r.error);
    expect(r.value).toBe(5n);
    expect(r.size).toBe(8);
  });

  it("supports nested dereference **reg", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "x0" ? 0x700000n : null),
      readMemory: (addr) => {
        if (addr === 0x700000n) return 0x700008n;
        if (addr === 0x700008n) return 99n;
        return null;
      },
      resolveSymbol: () => null,
    };
    const r = evaluateWatch("**x0", ctx);
    if ("error" in r) throw new Error(r.error);
    expect(r.value).toBe(99n);
  });
});
