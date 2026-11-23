// pins the question a program load asks before it replaces the student's
// work: when the browser's storage has no room for a copy of a saved helper
// the load replaces, the question names it, and no means nothing loads.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkspaceImport } from "@/components/playground/use-workspace-import";

function setup(unsaved: string[]) {
  const loadProgram = vi.fn();
  const unsavedBy = vi.fn(() => unsaved);
  const { result } = renderHook(() =>
    useWorkspaceImport({
      source: "",
      setSource: vi.fn(),
      extraFiles: [],
      setExtraFiles: vi.fn(),
      checks: [],
      toast: { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
      resetLaunch: vi.fn(),
      loadProgram,
      filesBackup: { count: 0, restore: vi.fn(), unsavedBy },
    }),
  );
  return { load: result.current.loadProgramWithConfirm, loadProgram, unsavedBy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a program load from the page's menus", () => {
  const payload = { source: "// echo", label: "echo", files: [{ name: "stack.s", body: "// s" }] };

  it("names the saved helpers it would replace with no copy, and loads nothing on no", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { load, loadProgram, unsavedBy } = setup(["util.s", "queue.s"]);
    expect(load(payload)).toBe(false);
    expect(unsavedBy).toHaveBeenCalledWith(payload.files);
    expect(confirm).toHaveBeenCalledWith(
      "Load echo? It replaces util.s, queue.s with no copy, because the browser's storage for this site is full.",
    );
    expect(loadProgram).not.toHaveBeenCalled();
  });

  it("loads on yes", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { load, loadProgram } = setup(["util.s"]);
    expect(load(payload)).toBe(true);
    expect(loadProgram).toHaveBeenCalledWith(payload);
  });

  it("loads without asking when every helper it replaces keeps a copy", () => {
    const confirm = vi.spyOn(window, "confirm");
    const { load, loadProgram } = setup([]);
    expect(load(payload)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(loadProgram).toHaveBeenCalledWith(payload);
  });
});
