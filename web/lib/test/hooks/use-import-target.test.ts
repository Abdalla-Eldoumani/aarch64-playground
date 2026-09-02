import { describe, expect, test } from "vitest";
import { describeTarget, getImportTarget } from "@/lib/hooks/use-import-target";

describe("getImportTarget", () => {
  test("activeFile -1 routes to main", () => {
    expect(getImportTarget(-1)).toEqual({ kind: "main" });
  });

  test("activeFile >= 0 routes to that extra", () => {
    expect(getImportTarget(0)).toEqual({ kind: "extra", index: 0 });
    expect(getImportTarget(3)).toEqual({ kind: "extra", index: 3 });
  });
});

describe("describeTarget", () => {
  test("main target names main.asm", () => {
    expect(describeTarget({ kind: "main" }, [])).toBe("main.asm");
  });
  test("extra uses file name when present", () => {
    expect(
      describeTarget({ kind: "extra", index: 0 }, [{ name: "helper.asm" }]),
    ).toBe("helper.asm");
  });
  test("extra falls back to index when name missing", () => {
    expect(describeTarget({ kind: "extra", index: 2 }, [])).toBe("extra 2");
  });
});
