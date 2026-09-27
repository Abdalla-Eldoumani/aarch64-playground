// The markdown report on its own: the two error boundaries build it without
// ever reaching the lz-string codec, so the format is pinned here rather than
// beside the compressor.

import { describe, expect, it } from "vitest";
import { bundleToMarkdown } from "@/lib/playground/bundle-markdown";
import type { DiagnosticBundle } from "@/lib/playground/diagnostic-bundle";

const ZERO = "0x0000000000000000";

const registers = Array.from({ length: 31 }, () => ZERO);
registers[0] = "0x0000000000000005";
registers[9] = "0xdeadbeefdeadbeef";

const sample: DiagnosticBundle = {
  source: ".global main\nmain:\n    bl helper\n    ret\n",
  files: [{ name: "util.s", body: "helper:\n    mov x0, 5\n    ret\n" }],
  args: "hello world",
  stdin: "42\n",
  stdout: "answer = 5\n",
  exitCode: 0,
  notes: ["first note", "second note"],
  status: "paused after 3 steps",
  pcAt: { file: "util.s", line: 2, text: "    mov x0, 5" },
  registers,
  fpRegisters: Array.from({ length: 32 }, (_, i) => (i === 1 ? "0x3ff8000000000000" : ZERO)),
  vectorRegisters: Array.from({ length: 32 }, (_, i) =>
    i === 2 ? "0x00000004000000030000000200000001" : `0x${"0".repeat(32)}`,
  ),
  sp: "0x000000007ffffff0",
  pc: "0x0000000000400008",
  nzcv: 0b0110,
  disassembly: ["   0x00400004  94000002  bl helper", "=> 0x00400008  d28000a0  mov x0, 5"],
  stack: ["0x7ffffff0  0x0000000000000000  sp"],
  memory: [{ name: ".data", lines: ["0x00600000  2a 00", "(every later byte of the first 4096 is zero)"] }],
  vfs: [{ name: "input.txt", body: "3 4\n" }],
  site: "2.7.0",
  emulator: "2.7.0",
  browser: "Chrome 140 on Windows",
};

describe("bundle markdown", () => {
  const md = bundleToMarkdown(sample, "https://example.com/playground?bundle=abc");

  it("opens by telling a fresh reader what the playground is and what to look for", () => {
    expect(md.startsWith("# Diagnostic bundle\n\nThis report comes from the AArch64 Playground")).toBe(true);
    expect(md).toContain("GNU as syntax, may use m4 macros");
    expect(md).toContain("Linux-like C library");
    expect(md).toContain("look for the first place they differ");
  });

  it("ends with the two empty slots the student fills in", () => {
    expect(md.endsWith("## What I expected\n\n\n## What I got\n\n")).toBe(true);
  });

  it("carries every file under its own name, in order", () => {
    expect(md).toContain("### main.asm\n\n```asm\n.global main\nmain:\n    bl helper\n    ret\n```");
    expect(md).toContain("### util.s\n\n```asm\nhelper:\n    mov x0, 5\n    ret\n```");
    expect(md.indexOf("### main.asm")).toBeLessThan(md.indexOf("### util.s"));
  });

  it("gives the input, the output, the notes, and the status", () => {
    expect(md).toContain("## Status\n\npaused after 3 steps");
    expect(md).toContain("Arguments: `hello world`");
    expect(md).toContain("Standard input:\n\n```text\n42\n```");
    expect(md).toContain("Standard output:\n\n```text\nanswer = 5\n```");
    expect(md).toContain("Exit code: 0");
    expect(md).toContain("- first note\n- second note");
  });

  it("names where the pc is and shows the instructions around it", () => {
    expect(md).toContain("pc = 0x0000000000400008, on util.s line 2: `mov x0, 5`");
    expect(md).toContain("=> 0x00400008  d28000a0  mov x0, 5");
  });

  it("reads every x register as hex and as a number", () => {
    expect(md).toContain("x0  = 0x0000000000000005  5");
    expect(md).toContain("x9  = 0xdeadbeefdeadbeef  -2401053088876216593, unsigned 16045690984833335023");
    expect(md).toContain("x29 = 0x0000000000000000  0 (fp)");
    expect(md).toContain("x30 = 0x0000000000000000  0 (lr)");
    expect(md).toContain("sp  = 0x000000007ffffff0");
    for (let i = 0; i <= 30; i++) expect(md).toMatch(new RegExp(`^x${i} +=`, "m"));
  });

  it("spells out what the flags mean for each condition", () => {
    expect(md).toContain("N=0 Z=1 C=1 V=0");
    expect(md).toContain("a b.cond branch is taken for: eq hs pl vc ls ge le");
    expect(md).toContain("and not taken for: ne lo mi vs hi lt gt");
  });

  it("accounts for every d and v register, one row per run of zeros", () => {
    expect(md).toContain("d0 = 0\nd1  = 0x3ff8000000000000  1.5\nd2 to d31 = 0");
    expect(md).toContain("v0 to v1 = 0\nv2  = 0x00000004000000030000000200000001  as 4s lanes 0 to 3: 1, 2, 3, 4\nv3 to v31 = 0");
  });

  it("includes the stack, the data sections, the virtual files, and the versions", () => {
    expect(md).toContain("0x7ffffff0  0x0000000000000000  sp");
    expect(md).toContain("### .data\n\n```text\n0x00600000  2a 00\n(every later byte of the first 4096 is zero)\n```");
    expect(md).toContain("### input.txt\n\n```text\n3 4\n```");
    expect(md).toContain("- Site: 2.7.0\n- Emulator: 2.7.0\n- Browser: Chrome 140 on Windows");
  });

  it("appends the playground link a caller hands it, before the slots", () => {
    const link = "[open in the playground](https://example.com/playground?bundle=abc)";
    expect(md).toContain(link);
    expect(md.indexOf(link)).toBeLessThan(md.indexOf("## What I expected"));
  });

  it("points an error at its file and line", () => {
    const failed = bundleToMarkdown({
      source: "main:\n    mvo x0, 1\n",
      error: "unknown instruction: mvo",
      errorAt: { file: null, line: 2, text: "    mvo x0, 1" },
    });
    expect(failed).toContain("## Error\n\n```text\nunknown instruction: mvo\n```\n\nAt main.asm line 2: `mvo x0, 1`");
  });

  it("keeps a program's own backticks from closing its code block", () => {
    const md2 = bundleToMarkdown({ source: "// a ``` fence\nret\n", args: "a`b" });
    expect(md2).toContain("````asm\n// a ``` fence\nret\n````");
    expect(md2).toContain("Arguments: `` a`b ``");
  });

  it("skips empty sections so a short report stays short", () => {
    const minimal = bundleToMarkdown({ source: "ret\n" });
    for (const heading of ["## Status", "## Error", "## Input", "## Output", "## Notes", "## Machine state", "## Virtual files", "## Versions"]) {
      expect(minimal).not.toContain(heading);
    }
    expect(minimal).toContain("### main.asm");
    expect(minimal).toContain("## What I got");
  });

  it("says so when a program that ran printed nothing", () => {
    const quiet = bundleToMarkdown({ source: "ret\n", registers: [ZERO], exitCode: 0 });
    expect(quiet).toContain("## Output\n\nNothing was printed.\n\nExit code: 0");
  });
});
