// pins the multi-file tab strip: main.asm always leads, the active tab
// carries the cyan fill, select/remove/add/rename report through their
// callbacks with trimmed names, and combineSources joins main and the
// extras with file-boundary comments.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import {
  MultiFileTabs,
  combineSources,
  useSourceFiles,
} from "@/components/playground/MultiFileTabs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FILES = [
  { name: "lib.asm", body: "// lib" },
  { name: "util.asm", body: "// util" },
];

function renderTabs(activeIndex = -1) {
  const handlers = {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onRename: vi.fn(),
  };
  render(
    <MultiFileTabs
      files={FILES}
      activeIndex={activeIndex}
      {...handlers}
    />,
  );
  return handlers;
}

describe("MultiFileTabs", () => {
  it("always leads with main.asm and lists every extra file", () => {
    renderTabs();
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names[0]).toBe("main.asm");
    expect(screen.getByText("lib.asm")).toBeTruthy();
    expect(screen.getByText("util.asm")).toBeTruthy();
  });

  it("fills the active tab cyan: main at -1, the file wrapper at its index", () => {
    renderTabs(-1);
    expect(screen.getByText("main.asm").className).toContain("bg-[var(--cyan)]");
    cleanup();
    renderTabs(1);
    expect(screen.getByText("main.asm").className).not.toContain("bg-[var(--cyan)]");
    const wrapper = screen.getByText("util.asm").closest("span") as HTMLElement;
    expect(wrapper.className).toContain("bg-[var(--cyan)]");
  });

  it("selects main.asm as index -1 and files by their index", () => {
    const h = renderTabs();
    fireEvent.click(screen.getByText("main.asm"));
    expect(h.onSelect).toHaveBeenCalledWith(-1);
    fireEvent.click(screen.getByText("util.asm"));
    expect(h.onSelect).toHaveBeenCalledWith(1);
  });

  it("removes a file from its labelled x button", () => {
    const h = renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "remove util.asm" }));
    expect(h.onRemove).toHaveBeenCalledWith(1);
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it("adds a trimmed file name and clears the input", () => {
    const h = renderTabs();
    const input = screen.getByPlaceholderText("new.asm") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  helpers.asm  " } });
    fireEvent.click(screen.getByRole("button", { name: "add file" }));
    expect(h.onAdd).toHaveBeenCalledWith("helpers.asm");
    expect(input.value).toBe("");
  });

  it("ignores a whitespace-only add", () => {
    const h = renderTabs();
    fireEvent.change(screen.getByPlaceholderText("new.asm"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "add file" }));
    expect(h.onAdd).not.toHaveBeenCalled();
  });

  it("renames on double click through the prompt, trimmed", () => {
    const h = renderTabs();
    vi.spyOn(window, "prompt").mockReturnValue("  renamed.asm ");
    fireEvent.doubleClick(screen.getByText("lib.asm"));
    expect(h.onRename).toHaveBeenCalledWith(0, "renamed.asm");
  });

  it("keeps the name when the prompt is cancelled or blank", () => {
    const h = renderTabs();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    fireEvent.doubleClick(screen.getByText("lib.asm"));
    prompt.mockReturnValue("   ");
    fireEvent.doubleClick(screen.getByText("lib.asm"));
    expect(h.onRename).not.toHaveBeenCalled();
  });
});

describe("combineSources", () => {
  it("returns main untouched when there are no extras", () => {
    expect(combineSources("mov x0, 1", [])).toBe("mov x0, 1");
  });

  it("keeps main line-for-line and labels only the extras", () => {
    // main.asm must stay 1:1 with the editor buffer: a header line above
    // it shifted the line map, error lines, and breakpoints by one.
    expect(combineSources("mov x0, 1", [{ name: "util.asm", body: "ret" }])).toBe(
      "mov x0, 1\n// ---- util.asm ----\nret",
    );
  });
});

describe("MultiFileTabs restore offer", () => {
  it("stays out of the way when nothing was replaced", () => {
    render(
      <MultiFileTabs
        files={FILES}
        activeIndex={-1}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onRename={vi.fn()}
        backupCount={0}
        onRestoreBackup={vi.fn()}
      />,
    );
    expect(screen.queryByText(/restore/)).toBeNull();
  });

  it("offers the discarded files back and counts them", () => {
    const onRestoreBackup = vi.fn();
    render(
      <MultiFileTabs
        files={[]}
        activeIndex={-1}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onRename={vi.fn()}
        backupCount={2}
        onRestoreBackup={onRestoreBackup}
      />,
    );
    const button = screen.getByText("restore 2 replaced files");
    fireEvent.click(button);
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
  });
});

describe("useSourceFiles", () => {
  // Loading a program REPLACES the strip on purpose. Until the backup
  // existed, a plain click on a recent program (no confirm) took every
  // helper file with it and only the strip's own localStorage key was
  // rewritten -- with `[]`.
  afterEach(() => {
    window.localStorage.clear();
  });

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
