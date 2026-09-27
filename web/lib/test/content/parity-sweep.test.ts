import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// scripts/parity-sweep.js writes its report as a markdown table. It is
// CommonJS and sits one level above web/ (vitest's cwd), so it is loaded by
// path; loading it starts no sweep.
const nodeRequire = createRequire(import.meta.url);
const { markdownCell } = nodeRequire(
  path.join(process.cwd(), "..", "scripts", "parity-sweep.js"),
) as { markdownCell: (text: string) => string };

describe("the parity report's table cells", () => {
  it("keeps a pipe from splitting the row", () => {
    expect(markdownCell("a | b")).toBe("a \\| b");
  });

  it("keeps a backslash in the text from cancelling the pipe's escape", () => {
    // Input a\|b. Doubling the backslash first gives a\\ then \| for the
    // pipe; escaping the pipe alone would leave a\\|, a literal backslash
    // followed by a bare pipe that ends the cell.
    expect(markdownCell("a\\|b")).toBe("a\\\\\\|b");
    expect(markdownCell("C:\\tmp\\x")).toBe("C:\\\\tmp\\\\x");
  });

  it("keeps a note that spans lines on one row", () => {
    expect(markdownCell("first\nsecond\r\nthird\rfourth")).toBe("first second third fourth");
  });
});
