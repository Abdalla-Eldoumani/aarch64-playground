import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The three section renderers are replaced with text markers so this test
// exercises only the shell's wiring (which tab is active -> which section fills
// the panel) without pulling in the markdown, diagram, or share stacks. The
// Instructions marker echoes the instruction count it receives, so the
// assertion proves the prop actually flowed through.
vi.mock("@/components/InstructionReference", () => ({
  InstructionReference: ({ instructions }: { instructions: unknown[] }) =>
    `instruction-reference:${instructions.length}`,
}));
vi.mock("@/components/CallingConventionGuide", () => ({
  CallingConventionGuide: () => "calling-convention-guide",
}));
vi.mock("@/components/PitfallsCatalog", () => ({
  PitfallsCatalog: () => "pitfalls-catalog",
}));

import type { ReferenceInstruction } from "@/lib/reference-data";
import { ReferenceView } from "./ReferenceView";

const THEMES = ["dark", "light", "high-contrast"] as const;

const INSTRUCTIONS: ReferenceInstruction[] = [
  {
    mnemonic: "mov",
    category: "Data processing",
    syntax: "mov xd, xn",
    summary: "move a value",
    example: "mov x0, x1",
  },
  {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, xm",
    summary: "add two values",
    example: "add x0, x1, x2",
  },
];

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("ReferenceView", () => {
  it("renders the three reference tabs with Instructions active by default", () => {
    render(<ReferenceView instructions={INSTRUCTIONS} />);
    expect(
      screen.getByRole("tablist", { name: "reference sections" }),
    ).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Instructions",
      "Calling convention",
      "Pitfalls",
    ]);
    expect(
      screen.getByRole("tab", { name: "Instructions" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByText(`instruction-reference:${INSTRUCTIONS.length}`),
    ).toBeTruthy();
  });

  it("swaps the panel section when another tab is clicked", () => {
    render(<ReferenceView instructions={INSTRUCTIONS} />);

    fireEvent.click(screen.getByRole("tab", { name: "Calling convention" }));
    expect(screen.getByText("calling-convention-guide")).toBeTruthy();
    expect(
      screen.queryByText(`instruction-reference:${INSTRUCTIONS.length}`),
    ).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));
    expect(screen.getByText("pitfalls-catalog")).toBeTruthy();
    expect(screen.queryByText("calling-convention-guide")).toBeNull();
  });

  it("moves between sections with the arrow keys", () => {
    render(<ReferenceView instructions={INSTRUCTIONS} />);
    const tablist = screen.getByRole("tablist");

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("tab", { name: "Calling convention" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("calling-convention-guide")).toBeTruthy();

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(screen.getByText("pitfalls-catalog")).toBeTruthy();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<ReferenceView instructions={INSTRUCTIONS} />);
      expect(screen.getByRole("tablist")).toBeTruthy();
      expect(
        screen.getByText(`instruction-reference:${INSTRUCTIONS.length}`),
      ).toBeTruthy();
      unmount();
    }
  });
});
