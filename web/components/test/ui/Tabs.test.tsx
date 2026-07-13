import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/Tabs";

const THEMES = ["dark", "light", "high-contrast"] as const;

const ITEMS: TabItem[] = [
  { value: "regs", label: "Registers" },
  { value: "memory", label: "Memory" },
  { value: "stack", label: "Stack" },
];

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

function Harness({ initial = "regs" }: { initial?: string }) {
  const [active, setActive] = useState(initial);
  return (
    <Tabs items={ITEMS} active={active} onChange={setActive} label="panels">
      <span>panel: {active}</span>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("exposes the tablist / tab / tabpanel ARIA structure", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "panels" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tabpanel")).toBeTruthy();
  });

  it("marks the selected tab with the cyan token and roving tabindex", () => {
    render(<Harness />);
    const selected = screen.getByRole("tab", { name: "Registers" });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(selected.getAttribute("tabindex")).toBe("0");
    expect(selected.className).toContain("text-[var(--cyan)]");
    expect(selected.className).toContain("border-[var(--cyan)]");

    const idle = screen.getByRole("tab", { name: "Memory" });
    expect(idle.getAttribute("aria-selected")).toBe("false");
    expect(idle.getAttribute("tabindex")).toBe("-1");
    expect(idle.className).not.toContain("text-[var(--cyan)]");
  });

  it("calls onChange with the tab value when clicked", () => {
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} active="regs" onChange={onChange} label="panels" />);
    fireEvent.click(screen.getByRole("tab", { name: "Memory" }));
    expect(onChange).toHaveBeenCalledWith("memory");
  });

  it("switches selection on click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Stack" }));
    const selected = screen.getByRole("tab", { name: "Stack" });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(selected.className).toContain("text-[var(--cyan)]");
  });

  it("moves selection with the arrow keys", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Memory" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Registers" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<Harness />);
      expect(screen.getByRole("tablist")).toBeTruthy();
      unmount();
    }
  });
});
