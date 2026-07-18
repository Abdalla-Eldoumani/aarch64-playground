import { describe, expect, it } from "vitest";
import { toggleLineComment } from "@/lib/asm/line-comment";

describe("toggleLineComment", () => {
  it("comments a single line from a zero-width caret", () => {
    const r = toggleLineComment("mov x0, 0", 4, 4);
    expect(r.text).toBe("// mov x0, 0");
    expect(r.selStart).toBe(0);
    expect(r.selEnd).toBe("// mov x0, 0".length);
  });

  it("uncomments a single commented line", () => {
    const r = toggleLineComment("// mov x0, 0", 0, 12);
    expect(r.text).toBe("mov x0, 0");
  });

  it("comments every selected line at the shared minimum indentation", () => {
    const input = "  mov x0, 0\n  ret";
    const r = toggleLineComment(input, 0, input.length);
    expect(r.text).toBe("  // mov x0, 0\n  // ret");
  });

  it("uncomments every selected commented line", () => {
    const input = "  // mov x0, 0\n  // ret";
    const r = toggleLineComment(input, 0, input.length);
    expect(r.text).toBe("  mov x0, 0\n  ret");
  });

  it("comments all lines when the selection is mixed (any line uncommented)", () => {
    // VS Code toggles ON when not every line is already commented, so an
    // already-commented line picks up a second marker.
    const input = "// a\nb";
    const r = toggleLineComment(input, 0, input.length);
    expect(r.text).toBe("// // a\n// b");
  });

  it("leaves blank lines untouched when commenting", () => {
    const input = "mov x0, 0\n\nret";
    const r = toggleLineComment(input, 0, input.length);
    expect(r.text).toBe("// mov x0, 0\n\n// ret");
  });

  it("removes a bare // with no following space", () => {
    const r = toggleLineComment("//mov x0, 0", 0, 11);
    expect(r.text).toBe("mov x0, 0");
  });

  it("round-trips: comment then uncomment restores the original", () => {
    const input = "  mov x0, 0\n  add x1, x1, 1\n  ret";
    const commented = toggleLineComment(input, 0, input.length);
    const restored = toggleLineComment(
      commented.text,
      commented.selStart,
      commented.selEnd,
    );
    expect(restored.text).toBe(input);
  });

  it("toggles whole lines even when the selection covers only part of them", () => {
    // Selection from the middle of line 1 to the middle of line 2.
    const input = "mov x0, 0\nret";
    const r = toggleLineComment(input, 4, 11);
    expect(r.text).toBe("// mov x0, 0\n// ret");
  });

  it("handles a reversed selection (selStart > selEnd)", () => {
    const r = toggleLineComment("mov x0, 0", 9, 0);
    expect(r.text).toBe("// mov x0, 0");
  });

  it("returns the toggled block as the new selection", () => {
    const input = "mov x0, 0\nret";
    const r = toggleLineComment(input, 0, input.length);
    // Whole buffer was one block starting at 0.
    expect(r.selStart).toBe(0);
    expect(r.selEnd).toBe(r.text.length);
  });
});
