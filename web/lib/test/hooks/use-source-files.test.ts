// pins the multi-file workspace state behind the tab strip: a write that
// replaces the strip keeps whatever it discarded recoverable, restore appends
// beside the new program's own helpers, an edit or a rename is not a
// discard, and the backup survives a reload.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useSourceFiles } from "@/lib/hooks/use-source-files";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("useSourceFiles", () => {
  // Loading a program REPLACES the strip on purpose. Without the backup, a
  // plain click on a recent program (no confirm) takes every helper file with
  // it and rewrites the strip's localStorage key to `[]`.
  it("keeps a wiped strip recoverable and appends it back on restore", () => {
    const { result } = renderHook(() => useSourceFiles());
    act(() => {
      result.current[1]([
        { name: "util.s", body: "// util" },
        { name: "sort.s", body: "// sort" },
      ]);
    });
    expect(result.current[2].count).toBe(0);

    // A program handoff with no files of its own.
    act(() => {
      result.current[1]([]);
    });
    expect(result.current[0]).toEqual([]);
    expect(result.current[2].count).toBe(2);

    act(() => {
      result.current[2].restore();
    });
    expect(result.current[0].map((f) => f.name)).toEqual(["util.s", "sort.s"]);
    expect(result.current[2].count).toBe(0);
  });

  it("restores beside a program's own helpers rather than over them", () => {
    const { result } = renderHook(() => useSourceFiles());
    act(() => {
      result.current[1]([{ name: "mine.s", body: "// mine" }]);
    });
    act(() => {
      result.current[1]([{ name: "theirs.s", body: "// theirs" }]);
    });
    expect(result.current[2].count).toBe(1);
    act(() => {
      result.current[2].restore();
    });
    expect(result.current[0].map((f) => f.name)).toEqual(["theirs.s", "mine.s"]);
  });

  it("does not offer a restore for an edit or a rename", () => {
    const { result } = renderHook(() => useSourceFiles());
    act(() => {
      result.current[1]([{ name: "util.s", body: "// util" }]);
    });
    act(() => {
      result.current[1]([{ name: "util.s", body: "// util edited" }]);
    });
    expect(result.current[2].count).toBe(0);
    act(() => {
      result.current[1]([{ name: "helpers.s", body: "// util edited" }]);
    });
    expect(result.current[2].count).toBe(0);
  });

  it("brings the backup back after a reload", () => {
    const first = renderHook(() => useSourceFiles());
    act(() => {
      first.result.current[1]([{ name: "util.s", body: "// util" }]);
    });
    act(() => {
      first.result.current[1]([]);
    });
    first.unmount();

    const second = renderHook(() => useSourceFiles());
    expect(second.result.current[2].count).toBe(1);
  });
});
