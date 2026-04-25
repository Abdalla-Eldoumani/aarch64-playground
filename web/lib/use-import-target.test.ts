import { describe, expect, test } from "vitest";
import { describeTarget, getImportTarget } from "@/lib/use-import-target";

describe("getImportTarget", () => {
  test("playground + activeFile -1 routes to main", () => {
    expect(getImportTarget("playground", -1)).toEqual({ kind: "main" });
  });

  test("playground + activeFile >= 0 routes to that extra", () => {
    expect(getImportTarget("playground", 0)).toEqual({ kind: "extra", index: 0 });
    expect(getImportTarget("playground", 3)).toEqual({ kind: "extra", index: 3 });
  });

  test("c-to-asm view routes to c-to-asm with subview", () => {
    expect(getImportTarget("c-to-asm", -1)).toEqual({
      kind: "c-to-asm",
      subview: "asm",
    });
    expect(getImportTarget("c-to-asm", 0, "c")).toEqual({
      kind: "c-to-asm",
      subview: "c",
    });
  });
});

describe("describeTarget", () => {
  test("main", () => {
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
  test("c-to-asm subview labels", () => {
    expect(describeTarget({ kind: "c-to-asm", subview: "c" }, [])).toBe("c source");
    expect(describeTarget({ kind: "c-to-asm", subview: "asm" }, [])).toBe("asm output");
  });
});
