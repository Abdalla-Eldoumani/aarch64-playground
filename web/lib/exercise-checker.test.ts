import { describe, expect, it } from "vitest";
import { checkExercise, type CheckerSnapshot } from "./exercise-checker";
import type { Acceptance } from "@/lib/exercise-schema";

// Plain mock snapshots: no wasm, no React. Every register defaults to zero and
// each case overrides only what it exercises.
const ZERO = `0x${"0".repeat(16)}`;

function regs(over: Record<number, string>): string[] {
  const list = Array<string>(31).fill(ZERO);
  for (const [index, value] of Object.entries(over)) list[Number(index)] = value;
  return list;
}

function snap(over: Partial<CheckerSnapshot> = {}): CheckerSnapshot {
  return { registers: regs({}), sp: ZERO, exitCode: 0, stdout: "", ...over };
}

/** Encode a value as the emulator's 64-bit hex register string. */
function hex(value: number | bigint): string {
  return `0x${BigInt.asUintN(64, BigInt(value)).toString(16).padStart(16, "0")}`;
}

describe("checkExercise result assertions", () => {
  it("passes a register that equals the expectation and reports expected/actual", () => {
    const acc: Acceptance = { results: [{ kind: "register", reg: "x0", equals: 120 }] };
    const result = checkExercise(acc, snap({ registers: regs({ 0: hex(120) }) }), "");
    expect(result.pass).toBe(true);
    expect(result.results[0].pass).toBe(true);
    expect(result.results[0].expected).toBe("120");
    expect(result.results[0].actual).toBe("120");
  });

  it("fails a register that does not equal the expectation, showing the observed value", () => {
    const acc: Acceptance = { results: [{ kind: "register", reg: "x0", equals: 120 }] };
    const result = checkExercise(acc, snap(), "");
    expect(result.pass).toBe(false);
    expect(result.results[0].pass).toBe(false);
    expect(result.results[0].expected).toBe("120");
    expect(result.results[0].actual).toBe("0");
  });

  it("matches a negative expectation against the two's-complement register value", () => {
    const acc: Acceptance = { results: [{ kind: "register", reg: "x0", equals: -1 }] };
    const result = checkExercise(acc, snap({ registers: regs({ 0: hex(-1) }) }), "");
    expect(result.results[0].pass).toBe(true);
    expect(result.results[0].actual).toBe("-1");
  });

  it("reads the stack pointer for an sp register assertion", () => {
    const acc: Acceptance = { results: [{ kind: "register", reg: "sp", equals: 120 }] };
    expect(checkExercise(acc, snap({ sp: hex(120) }), "").results[0].pass).toBe(true);
  });

  it("reports a register that cannot be read as unavailable", () => {
    const acc: Acceptance = { results: [{ kind: "register", reg: "x0", equals: 1 }] };
    const result = checkExercise(acc, snap({ registers: [] }), "");
    expect(result.results[0].pass).toBe(false);
    expect(result.results[0].actual).toBe("unavailable");
  });

  it("checks the exit code, passing on a match and failing otherwise", () => {
    const acc: Acceptance = { results: [{ kind: "exit", equals: 0 }] };
    expect(checkExercise(acc, snap({ exitCode: 0 }), "").results[0].pass).toBe(true);
    const fail = checkExercise(acc, snap({ exitCode: 1 }), "");
    expect(fail.results[0].pass).toBe(false);
    expect(fail.results[0].actual).toBe("1");
    expect(checkExercise(acc, snap({ exitCode: null }), "").results[0].actual).toBe("none");
  });

  it("checks stdout for an exact match", () => {
    const acc: Acceptance = { results: [{ kind: "stdout", equals: "120\n" }] };
    expect(checkExercise(acc, snap({ stdout: "120\n" }), "").results[0].pass).toBe(true);
    expect(checkExercise(acc, snap({ stdout: "121\n" }), "").results[0].pass).toBe(false);
  });

  it("checks stdout against a declared pattern", () => {
    const acc: Acceptance = { results: [{ kind: "stdout", matches: "result = \\d+" }] };
    expect(checkExercise(acc, snap({ stdout: "result = 120\n" }), "").results[0].pass).toBe(true);
    expect(checkExercise(acc, snap({ stdout: "no number here\n" }), "").results[0].pass).toBe(false);
  });
});

describe("checkExercise structural assertions", () => {
  const usesBlt: Acceptance = {
    results: [{ kind: "exit", equals: 0 }],
    structural: [{ kind: "uses-instruction", mnemonic: "b.lt" }],
  };

  it("passes uses-instruction when the mnemonic is present in real code", () => {
    expect(checkExercise(usesBlt, snap(), "    b.lt loop\n").structural[0].pass).toBe(true);
  });

  it("fails uses-instruction when the mnemonic is absent", () => {
    expect(checkExercise(usesBlt, snap(), "    add x0, x0, 1\n").structural[0].pass).toBe(false);
  });

  it("does not count a mnemonic that appears only inside a comment", () => {
    const source = "    add x0, x0, 1   // could use b.lt here\n";
    expect(checkExercise(usesBlt, snap(), source).structural[0].pass).toBe(false);
  });

  it("matches the mnemonic as a standalone token, not a substring", () => {
    const acc: Acceptance = {
      results: [{ kind: "exit", equals: 0 }],
      structural: [{ kind: "uses-instruction", mnemonic: "sub" }],
    };
    expect(checkExercise(acc, snap(), "    subs x0, x0, 1\n").structural[0].pass).toBe(false);
  });

  it("fails forbids-literal when the number is used in real code", () => {
    const acc: Acceptance = {
      results: [{ kind: "exit", equals: 0 }],
      structural: [{ kind: "forbids-literal", value: 120 }],
    };
    expect(checkExercise(acc, snap(), "    mov x0, 120\n").structural[0].pass).toBe(false);
  });

  it("passes forbids-literal when the number appears only inside a comment", () => {
    const acc: Acceptance = {
      results: [{ kind: "exit", equals: 0 }],
      structural: [{ kind: "forbids-literal", value: 120 }],
    };
    expect(checkExercise(acc, snap(), "    mov x0, 5   // not 120\n").structural[0].pass).toBe(true);
  });

  it("passes forbids-literal for a longer number that merely contains the digits", () => {
    const acc: Acceptance = {
      results: [{ kind: "exit", equals: 0 }],
      structural: [{ kind: "forbids-literal", value: 120 }],
    };
    expect(checkExercise(acc, snap(), "    mov x0, 1200\n").structural[0].pass).toBe(true);
  });

  it("forbids a string literal as a plain substring", () => {
    const acc: Acceptance = {
      results: [{ kind: "exit", equals: 0 }],
      structural: [{ kind: "forbids-literal", value: "printf" }],
    };
    expect(checkExercise(acc, snap(), "    bl printf\n").structural[0].pass).toBe(false);
    expect(checkExercise(acc, snap(), "    bl puts\n").structural[0].pass).toBe(true);
  });
});

describe("checkExercise aggregation", () => {
  const multi: Acceptance = {
    results: [
      { kind: "register", reg: "x0", equals: 120 },
      { kind: "exit", equals: 0 },
    ],
    structural: [{ kind: "uses-instruction", mnemonic: "b.lt" }],
  };

  it("passes overall only when every result and structural check passes", () => {
    const result = checkExercise(
      multi,
      snap({ registers: regs({ 0: hex(120) }), exitCode: 0 }),
      "    b.lt loop\n",
    );
    expect(result.pass).toBe(true);
    expect(result.summary).toMatch(/all checks passed/i);
  });

  it("fails overall and names the failed count when checks fail", () => {
    const result = checkExercise(
      multi,
      snap({ registers: regs({ 0: hex(5) }), exitCode: 1 }),
      "    add x0, x0, 1\n",
    );
    expect(result.pass).toBe(false);
    expect(result.summary).toContain("3 of 3");
    expect(result.results[0].expected).toBe("120");
    expect(result.results[0].actual).toBe("5");
  });

  it("takes exactly three arguments, with no reference-solution parameter", () => {
    expect(checkExercise.length).toBe(3);
  });
});
