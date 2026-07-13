import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecentPrograms } from "@/components/playground/RecentPrograms";

afterEach(() => cleanup());

/** Open the custom select's listbox. */
function openList(): HTMLElement {
  fireEvent.click(screen.getByRole("combobox", { name: "load recent program" }));
  return screen.getByRole("listbox");
}

function pick(label: string) {
  const option = Array.from(
    openList().querySelectorAll('[role="option"]'),
  ).find((candidate) => candidate.textContent === label)!;
  fireEvent.pointerDown(option);
}

describe("RecentPrograms", () => {
  it("disables the select when no entries are present", () => {
    render(<RecentPrograms entries={[]} onLoad={() => {}} onClear={() => {}} />);
    const trigger = screen.getByRole("combobox", {
      name: "load recent program",
    }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });

  it("renders one option per entry plus the clear sentinel", () => {
    const entries = [
      { id: "a", name: "first.asm", body: "// a", savedAt: 1 },
      { id: "b", name: "second.asm", body: "// b", savedAt: 2 },
    ];
    render(<RecentPrograms entries={entries} onLoad={() => {}} onClear={() => {}} />);
    openList();
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("first.asm");
    expect(options).toContain("second.asm");
    expect(options).toContain("clear history");
  });

  it("calls onLoad with the entry body when picked", () => {
    const onLoad = vi.fn();
    const entries = [{ id: "a", name: "first.asm", body: "// the body", savedAt: 1 }];
    render(<RecentPrograms entries={entries} onLoad={onLoad} onClear={() => {}} />);
    pick("first.asm");
    expect(onLoad).toHaveBeenCalledWith("// the body");
  });

  it("calls onClear when the user picks the clear sentinel", () => {
    const onClear = vi.fn();
    const entries = [{ id: "a", name: "first.asm", body: "// a", savedAt: 1 }];
    render(<RecentPrograms entries={entries} onLoad={() => {}} onClear={onClear} />);
    pick("clear history");
    expect(onClear).toHaveBeenCalled();
  });

  it("falls back to '(untitled)' for entries with empty names", () => {
    const entries = [{ id: "a", name: "", body: "// a", savedAt: 1 }];
    render(<RecentPrograms entries={entries} onLoad={() => {}} onClear={() => {}} />);
    openList();
    expect(screen.getByText("(untitled)")).toBeTruthy();
  });
});
