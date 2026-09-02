// The markdown report on its own: the two error boundaries build it without
// ever reaching the lz-string codec, so the format is pinned here rather than
// beside the compressor.

import { describe, expect, it } from "vitest";
import { bundleToMarkdown } from "@/lib/playground/bundle-markdown";
import type { DiagnosticBundle } from "@/lib/playground/diagnostic-bundle";

const sample: DiagnosticBundle = {
  source: ".text\nmain:\n    mov x0, 5\n    svc 0\n",
  args: "./prog hello world",
  stdin: "42\n",
  stdout: "answer = 5\n",
  stderr: "",
  exitCode: 0,
  registers: [
    "0x0000000000000005",
    "0x0000000000000000",
  ],
  sp: "0x0000000080000000",
  pc: "0x0000000000400008",
  stackBytes: "00 00 00 00 00 00 00 00",
  error: null,
};

describe("bundle markdown", () => {
  it("includes every populated section", () => {
    const md = bundleToMarkdown(sample);
    expect(md).toContain("# diagnostic bundle");
    expect(md).toContain("```asm");
    expect(md).toContain("mov x0, 5");
    expect(md).toContain("**args:** `./prog hello world`");
    expect(md).toContain("**stdin:**");
    expect(md).toContain("**stdout:**");
    expect(md).toContain("**exit code:** 0");
    expect(md).toContain("pc = 0x0000000000400008");
    expect(md).toContain("**last 64 stack bytes");
  });

  it("skips empty optional sections so reports stay short", () => {
    const minimal: DiagnosticBundle = { source: "ret\n" };
    const md = bundleToMarkdown(minimal);
    expect(md).not.toContain("**args:**");
    expect(md).not.toContain("**stdin:**");
    expect(md).not.toContain("**stdout:**");
    expect(md).not.toContain("**stderr:**");
    expect(md).not.toContain("exit code");
    expect(md).not.toContain("last error");
    expect(md).not.toContain("registers:");
  });

  it("appends the playground link a caller hands it", () => {
    const md = bundleToMarkdown(sample, "https://example.com/path?bundle=abc");
    expect(md).toContain(
      "[open in the playground](https://example.com/path?bundle=abc)",
    );
  });
});
