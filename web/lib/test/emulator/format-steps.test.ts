import { describe, expect, it } from "vitest";
import { formatSteps } from "@/lib/emulator/format-steps";

describe("formatSteps", () => {
  it("writes one step in the singular and every other count in the plural", () => {
    expect(formatSteps(0)).toBe("0 steps");
    expect(formatSteps(1)).toBe("1 step");
    expect(formatSteps(2)).toBe("2 steps");
  });

  // The step cap pauses a run at a million steps; the status line, the error,
  // and the diagnostic report all write that number the same way.
  it("groups thousands with commas", () => {
    expect(formatSteps(1_000_000)).toBe("1,000,000 steps");
    expect(formatSteps(12_345)).toBe("12,345 steps");
  });
});
