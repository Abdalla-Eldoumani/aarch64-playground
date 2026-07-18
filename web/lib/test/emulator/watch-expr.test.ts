import { describe, expect, it } from "vitest";
import {
  evaluateWatch,
  type EvalContext,
  type EvalOk,
  type EvalOutcome,
  type MemRead,
} from "@/lib/emulator/watch-expr";

// A seeded read returns "unmapped" on a miss -- the production contract:
// the mapped verdict gates the bytes, so a missing address is a definite
// fault, never a zero-filled success.
function memory(seed: Record<string, bigint>): (addr: bigint, size: number) => MemRead {
  return (addr) => {
    const key = `0x${addr.toString(16)}`;
    return seed[key] ?? "unmapped";
  };
}

function ok(r: EvalOutcome): EvalOk {
  if ("error" in r) throw new Error(r.error);
  if ("pending" in r) throw new Error("unexpected pending");
  return r;
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
  resolveSlotOffset: (name) => (name === "score1_s" ? 16n : null),
  resolveLabelAddress: (name) => (name === "arr" ? 0x0070_0000n : null),
};

describe("watch expressions", () => {
  it("reads a full X register", () => {
    const r = ok(evaluateWatch("x0", baseCtx));
    expect(r.display).toBe("0x0000000000700000");
    expect(r.size).toBe(8);
  });

  it("masks a W register to 32 bits", () => {
    const r = ok(evaluateWatch("w0", baseCtx));
    expect(r.display).toBe("0x000000ab");
    expect(r.size).toBe(4);
  });

  it("dereferences a pointer register", () => {
    const r = ok(evaluateWatch("*x0", baseCtx));
    expect(r.display).toBe("0x00000000deadbeef");
  });

  it("reads [reg, literal] memory", () => {
    const r = ok(evaluateWatch("[fp, 16]", baseCtx));
    expect(r.display).toBe("0x0000000000000042");
  });

  it("reads [reg, alias]", () => {
    const r = ok(evaluateWatch("[fp, score1_s]", baseCtx));
    expect(r.display).toBe("0x0000000000000042");
  });

  it("reads array index", () => {
    const r = ok(evaluateWatch("arr[2]", baseCtx));
    expect(r.display).toBe("0x00000000000000c7");
  });

  it("resolves a frame-slot array against fp, never as an absolute address", () => {
    // score1_s = 16 is an OFFSET from fp. Dereferencing it as an address
    // read absolute 0x10, which zero-filled -- the debugger's core lie.
    const r = ok(evaluateWatch("score1_s[0]", baseCtx));
    expect(r.display).toBe("0x0000000000000042"); // fp + 16 + 0*8
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
      readMemory: () => "unmapped",
      resolveSlotOffset: () => null,
      resolveLabelAddress: () => null,
    };
    expect(evaluateWatch("*x1", ctx)).toEqual({ error: "fault reading 0x0000000000000000" });
  });

  it("a pending memory verdict surfaces as pending, not a value", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "x1" ? 0x700000n : null),
      readMemory: () => "pending",
      resolveSlotOffset: () => null,
      resolveLabelAddress: () => null,
    };
    expect(evaluateWatch("*x1", ctx)).toEqual({ pending: true });
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
      readMemory: (addr) => (addr === 0x700010n ? 77n : "unmapped"),
      resolveSlotOffset: () => null,
      resolveLabelAddress: (name) => (name === "arr" ? 0x700000n : null),
    };
    const r = ok(evaluateWatch("arr[w2]", ctx));
    expect(r.display).toBe("0x000000000000004d");
  });

  it("accepts a negative literal offset in [reg, offset]", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "sp" ? 0x8000_0000n : null),
      readMemory: (addr) => (addr === 0x7fff_fff0n ? 7n : "unmapped"),
      resolveSlotOffset: () => null,
      resolveLabelAddress: () => null,
    };
    const r = ok(evaluateWatch("[sp, -16]", ctx));
    expect(r.display).toBe("0x0000000000000007");
  });

  it("accepts a hex literal offset in [reg, offset]", () => {
    const r = ok(evaluateWatch("[fp, 0x10]", baseCtx));
    expect(r.display).toBe("0x0000000000000042");
  });

  it("tolerates surrounding whitespace and uppercase register names", () => {
    const r = ok(evaluateWatch("  X1  ", baseCtx));
    expect(r.display).toBe("0x0000000000001234");
  });

  it("reads lr like any named register", () => {
    const r = ok(evaluateWatch("lr", baseCtx));
    expect(r.display).toBe("0x0000000000401234");
    expect(r.size).toBe(8);
  });

  it("*w0 dereferences the 32-bit-masked address and reads 4 bytes", () => {
    // w0's raw backing is 0xffffffff000000ab; the W read masks the address
    // to 0xab, and the deref width follows the register: a w deref reads
    // a 4-byte word, the view students want for .word data.
    const ctx: EvalContext = {
      readRegister: (name) => (name === "w0" ? 0xffff_ffff_0000_00abn : null),
      readMemory: (addr, size) => (addr === 0xabn && size === 4 ? 5n : "unmapped"),
      resolveSlotOffset: () => null,
      resolveLabelAddress: () => null,
    };
    const r = ok(evaluateWatch("*w0", ctx));
    expect(r.value).toBe(5n);
    expect(r.size).toBe(4);
  });

  it("supports nested dereference **reg", () => {
    const ctx: EvalContext = {
      readRegister: (name) => (name === "x0" ? 0x700000n : null),
      readMemory: (addr) => {
        if (addr === 0x700000n) return 0x700008n;
        if (addr === 0x700008n) return 99n;
        return "unmapped";
      },
      resolveSlotOffset: () => null,
      resolveLabelAddress: () => null,
    };
    const r = ok(evaluateWatch("**x0", ctx));
    expect(r.value).toBe(99n);
  });
  it("returns an error, never throws, on a malformed hex offset", () => {
    // BigInt("0xZZ") throws; an unguarded throw here white-screened the
    // whole playground (WatchPanel renders evaluateWatch results directly).
    expect(() => evaluateWatch("[fp, 0xZZ]", baseCtx)).not.toThrow();
    const r = evaluateWatch("[fp, 0xZZ]", baseCtx);
    expect("error" in r).toBe(true);
  });

});
