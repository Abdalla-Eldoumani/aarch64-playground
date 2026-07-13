// pins the multi-file tab strip: main.asm always leads, the active tab
// carries the cyan fill, select/remove/add/rename report through their
// callbacks with trimmed names, and combineSources joins main and the
// extras with file-boundary comments.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MultiFileTabs, combineSources } from "@/components/playground/MultiFileTabs";

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

  it("joins main and extras with file-boundary comments", () => {
    expect(combineSources("mov x0, 1", [{ name: "util.asm", body: "ret" }])).toBe(
      "// ---- main.asm ----\nmov x0, 1\n// ---- util.asm ----\nret",
    );
  });
});
