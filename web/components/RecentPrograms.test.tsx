import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecentPrograms } from "./RecentPrograms";

afterEach(() => cleanup());

describe("RecentPrograms", () => {
  it("disables the select when no entries are present", () => {
    render(<RecentPrograms entries={[]} onLoad={() => {}} onClear={() => {}} />);
    const select = screen.getByLabelText("load recent program") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("renders one option per entry plus the clear sentinel", () => {
    const entries = [
      { id: "a", name: "first.asm", body: "// a", savedAt: 1 },
      { id: "b", name: "second.asm", body: "// b", savedAt: 2 },
    ];
    render(<RecentPrograms entries={entries} onLoad={() => {}} onClear={() => {}} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("first.asm");
    expect(options).toContain("second.asm");
    expect(options).toContain("clear history");
  });

  it("calls onLoad with the entry body when picked", () => {
    const onLoad = vi.fn();
    const entries = [{ id: "a", name: "first.asm", body: "// the body", savedAt: 1 }];
    render(<RecentPrograms entries={entries} onLoad={onLoad} onClear={() => {}} />);
    const select = screen.getByLabelText("load recent program") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "a" } });
    expect(onLoad).toHaveBeenCalledWith("// the body");
  });

  it("calls onClear when the user picks the clear sentinel", () => {
    const onClear = vi.fn();
    const entries = [{ id: "a", name: "first.asm", body: "// a", savedAt: 1 }];
    render(<RecentPrograms entries={entries} onLoad={() => {}} onClear={onClear} />);
    const select = screen.getByLabelText("load recent program") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "__clear__" } });
    expect(onClear).toHaveBeenCalled();
  });

  it("falls back to '(untitled)' for entries with empty names", () => {
    const entries = [{ id: "a", name: "", body: "// a", savedAt: 1 }];
    render(<RecentPrograms entries={entries} onLoad={() => {}} onClear={() => {}} />);
    expect(screen.getByText("(untitled)")).toBeTruthy();
  });
});
