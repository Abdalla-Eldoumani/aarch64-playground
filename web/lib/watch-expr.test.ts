import { describe, expect, it } from "vitest";
import { evaluateWatch, type EvalContext } from "./watch-expr";

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
