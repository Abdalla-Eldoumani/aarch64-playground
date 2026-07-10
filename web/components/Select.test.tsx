import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Select } from "./Select";

afterEach(() => cleanup());

const GROUPS = [
  {
    label: "First",
    options: [
      { value: "alpha", label: "alpha row" },
      { value: "bravo", label: "bravo row" },
    ],
  },
  {
    label: "Second",
    options: [{ value: "charlie", label: "charlie row" }],
  },
];

function renderSelect(onSelect = vi.fn(), extra: Partial<Parameters<typeof Select>[0]> = {}) {
  render(
    <Select
      placeholder="pick..."
      ariaLabel="test select"
      groups={GROUPS}
      onSelect={onSelect}
      {...extra}
    />,
  );
  return onSelect;
}

function trigger(): HTMLButtonElement {
  return screen.getByRole("combobox", { name: "test select" }) as HTMLButtonElement;
}

describe("Select", () => {
  it("renders the placeholder closed, with no listbox in the tree", () => {
    renderSelect();
    expect(trigger().textContent).toContain("pick...");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on click, shows group headers and options, closes on outside pointer-down", () => {
    renderSelect();
    fireEvent.click(trigger());
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeTruthy();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getAllByRole("option").length).toBe(3);

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects an option on pointer-down and closes", () => {
    const onSelect = renderSelect();
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("bravo row"));
    expect(onSelect).toHaveBeenCalledWith("bravo");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigates with arrows and selects with Enter, all focus staying on the trigger", () => {
    const onSelect = renderSelect();
    const combo = trigger();
    fireEvent.keyDown(combo, { key: "ArrowDown" }); // opens at first option
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(combo, { key: "ArrowDown" });
    fireEvent.keyDown(combo, { key: "ArrowDown" });
    // activedescendant tracks the active option across group boundaries.
    const activeId = combo.getAttribute("aria-activedescendant")!;
    expect(document.getElementById(activeId)?.textContent).toBe("charlie row");
    fireEvent.keyDown(combo, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("charlie");
  });

  it("closes on Escape without selecting", () => {
    const onSelect = renderSelect();
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("type-ahead jumps to the next label with the typed prefix", () => {
    const onSelect = renderSelect();
    const combo = trigger();
    fireEvent.keyDown(combo, { key: "ArrowDown" }); // open
    fireEvent.keyDown(combo, { key: "c" });
    const activeId = combo.getAttribute("aria-activedescendant")!;
    expect(document.getElementById(activeId)?.textContent).toBe("charlie row");
    fireEvent.keyDown(combo, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("charlie");
  });

  it("marks the controlled value selected and shows its label on the trigger", () => {
    renderSelect(vi.fn(), { value: "bravo" });
    expect(trigger().textContent).toContain("bravo row");
    fireEvent.click(trigger());
    const selected = screen
      .getAllByRole("option")
      .find((option) => option.getAttribute("aria-selected") === "true");
    expect(selected?.textContent).toBe("bravo row");
  });

  it("does nothing when disabled", () => {
    renderSelect(vi.fn(), { disabled: true });
    expect(trigger().disabled).toBe(true);
    fireEvent.click(trigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
