import { describe, expect, it } from "vitest";
import { explainError } from "@/lib/asm/error-explain";

describe("explainError", () => {
  it("recognizes unknown instruction", () => {
    const e = explainError("unknown instruction: 0x12345678");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("general");
    expect(e!.what.toLowerCase()).toContain("decoder");
  });

  it("recognizes memory faults and distinguishes read from write", () => {
    const r = explainError("memory fault: read at 0x0000000000000010");
    const w = explainError("memory fault: write at 0x00000000ffff0000");
    expect(r).not.toBeNull();
    expect(w).not.toBeNull();
    expect(r!.what.toLowerCase()).toContain("read");
    expect(w!.what.toLowerCase()).toContain("write");
    expect(r!.styleSection).toBe("addressing modes");
  });

  it("recognizes invalid register index", () => {
    const e = explainError("invalid register index: 32");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("naming conventions");
  });

  it("recognizes unaligned access and quotes the alignment requirement", () => {
    const e = explainError("unaligned access at 0x0000000060000003 (requires 4-byte alignment)");
    expect(e).not.toBeNull();
    expect(e!.what).toContain("4-byte alignment");
  });

  it("recognizes stack overflow", () => {
    const e = explainError("stack overflow");
    expect(e).not.toBeNull();
  });

  it("recognizes argv overflow", () => {
    const e = explainError("argv layout would need 5000 bytes, exceeds the 4096-byte argv page");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("hosted runtime");
  });

  it("dispatches inside wrapped errors via the inner detail", () => {
    const e = explainError("preprocess error at line 7: unsupported m4 construct: ifelse");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("m4 preprocessing");
  });

  it("recognizes unknown symbol regardless of which stage reported it", () => {
    const a = explainError("link error at line 30: unknown symbol `score_1_r`");
    const b = explainError("parse error at line 12: undefined symbol foo");
    expect(a!.styleSection).toBe("naming conventions");
    expect(b!.styleSection).toBe("naming conventions");
  });

  it("recognizes immediate-out-of-range encodings", () => {
    const e = explainError("assembly error at line 18: immediate out of range for movz");
    expect(e!.styleSection).toBe("literal pool");
  });

  it("recognizes unbalanced bracket diagnostics", () => {
    const e = explainError("link error at line 9: unbalanced addressing bracket");
    expect(e!.styleSection).toBe("addressing modes");
  });

  it("explains an unterminated string with the same-line rule and the escape fix", () => {
    const e = explainError(
      'parse error at line 6: unterminated string literal: no closing " before the end of the line (write \\n for a newline)',
    );
    expect(e!.what).toContain("never closed");
    expect(e!.why).toContain("cannot span lines");
    expect(e!.fix).toContain("\\n");
  });

  it("explains mixed S/D operands and points at fcvt", () => {
    const e = explainError(
      "assembly error at line 4: fadd needs all S or all D registers (use fcvt to convert between widths)",
    );
    expect(e!.why).toContain("precision");
    expect(e!.fix).toContain("fcvt");
  });

  it("explains a same-width fcvt and points at fmov", () => {
    const e = explainError(
      "assembly error at line 7: fcvt converts between widths: one operand must be an S register and the other a D register (use fmov to copy at the same width)",
    );
    expect(e!.fix).toContain("fmov");
  });

  it("explains an unencodable fmov immediate with the data-section fallback", () => {
    const e = explainError(
      "assembly error at line 3: 0.1 does not fit the FMOV 8-bit float immediate; load it from a .double instead",
    );
    expect(e!.styleSection).toBe("literal pool");
    expect(e!.fix).toContain(".float");
  });

  it("falls back to a generic block for wrapped errors that don't match a pattern", () => {
    const e = explainError("assembly error at line 5: something genuinely strange");
    expect(e).not.toBeNull();
    expect(e!.styleSection).toBe("general");
  });

  it("returns null for completely unfamiliar messages", () => {
    expect(explainError("nope, just nope")).toBeNull();
  });
});
