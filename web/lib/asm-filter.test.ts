import { describe, expect, it } from "vitest";
import { filterAssembly, looksRunnable } from "./asm-filter";

const WITH_NOISE = `	.arch armv8-a
	.file	"a.c"
	.text
	.align	2
	.p2align 2
	.cfi_startproc
	.global	main
	.type	main, %function
main:
	.cfi_def_cfa_offset 0
.LFB0:
	mov	w0, 42
	ret
	.cfi_endproc
.LFE0:
	.size	main, .-main
	.ident	"GCC: ..."
`;

describe("asm filter", () => {
  it("drops cfi, file, align, size, ident, and .L-prefixed labels", () => {
    const out = filterAssembly(WITH_NOISE, { filterDirectives: true });
    expect(out).not.toContain(".cfi_");
    expect(out).not.toContain(".file");
    expect(out).not.toContain(".p2align");
    expect(out).not.toContain(".LFB0:");
    expect(out).not.toContain(".LFE0:");
    expect(out).not.toContain(".size");
    expect(out).not.toContain(".ident");
  });

  it("keeps real instructions and section directives", () => {
    const out = filterAssembly(WITH_NOISE, { filterDirectives: true });
    expect(out).toContain("mov");
    expect(out).toContain("ret");
    expect(out).toContain(".text");
    expect(out).toContain(".global	main");
    expect(out).toContain("main:");
  });

  it("passes through unchanged when filterDirectives=false", () => {
    const out = filterAssembly(WITH_NOISE, { filterDirectives: false });
    expect(out).toBe(WITH_NOISE);
  });

  it("looksRunnable returns true when real instructions are present", () => {
    expect(looksRunnable("main:\n\tmov x0, 1\n\tret\n")).toBe(true);
  });

  it("looksRunnable returns false for a section-only fragment", () => {
    expect(looksRunnable(".text\n.global main\nmain:\n")).toBe(false);
  });
});
