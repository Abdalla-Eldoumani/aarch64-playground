// pins the multi-file tab strip: main.asm always leads, the active tab
// carries the cyan fill, select/remove/add/rename report through their
// callbacks with trimmed names, and combineSources joins main and the
// extras with file-boundary comments.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  MultiFileTabs,
  combineSources,
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
    const strip = screen.getByRole("group", { name: "source files" });
    const names = [...strip.querySelectorAll("button[aria-current], button[tabindex]")]
      .filter((b) => b.textContent !== "x")
      .map((b) => b.textContent);
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

  it("renames from the keyboard on F2, so the strip is not double-click only", () => {
    const h = renderTabs(0);
    vi.spyOn(window, "prompt").mockReturnValue("renamed.asm");
    fireEvent.keyDown(screen.getByText("lib.asm"), { key: "F2" });
    expect(h.onRename).toHaveBeenCalledWith(0, "renamed.asm");
  });
});

describe("MultiFileTabs keyboard and roles", () => {
  // The strip is a labelled group, not a tablist: its children include the
  // label, remove buttons, and the new-file form, which a tablist may not
  // hold. The active file is stated with aria-current instead.
  it("is a labelled group whose current file is the only tab stop", () => {
    renderTabs(1);
    expect(screen.getByRole("group", { name: "source files" })).toBeTruthy();
    const fileButtons = [
      screen.getByText("main.asm"),
      screen.getByText("lib.asm"),
      screen.getByText("util.asm"),
    ];
    expect(fileButtons.map((t) => t.getAttribute("aria-current"))).toEqual([
      null,
      null,
      "true",
    ]);
    // Roving tabindex: one Tab press reaches the strip, arrows do the rest.
    expect(fileButtons.map((t) => t.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "0",
    ]);
  });

  it("marks main.asm current when the active index is -1", () => {
    renderTabs(-1);
    const main = screen.getByText("main.asm");
    expect(main.getAttribute("aria-current")).toBe("true");
    expect(main.getAttribute("tabindex")).toBe("0");
  });

  it("moves selection with the arrow keys, wrapping at both ends", () => {
    const h = renderTabs(-1);
    fireEvent.keyDown(screen.getByText("main.asm"), { key: "ArrowRight" });
    expect(h.onSelect).toHaveBeenCalledWith(0);
    // main.asm sits at the head of the order, so ArrowLeft wraps to the last
    // helper rather than dead-ending on the first tab.
    fireEvent.keyDown(screen.getByText("main.asm"), { key: "ArrowLeft" });
    expect(h.onSelect).toHaveBeenCalledWith(1);
  });

  it("leaves the new-file input's own arrow keys alone", () => {
    const h = renderTabs(-1);
    fireEvent.keyDown(screen.getByLabelText("new file name"), { key: "ArrowRight" });
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it("names the new-file input for anyone who cannot see its placeholder", () => {
    renderTabs();
    const input = screen.getByLabelText("new file name") as HTMLInputElement;
    expect(input.placeholder).toBe("new.asm");
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
