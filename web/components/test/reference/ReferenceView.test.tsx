import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The three section renderers are replaced with text markers so this test
// exercises only the shell's wiring (which tab is active -> which section fills
// the panel) without pulling in the markdown, diagram, or share stacks. The
// Instructions marker echoes the instruction count it receives, so the
// assertion proves the prop actually flowed through.
vi.mock("@/components/reference/InstructionReference", () => ({
  InstructionReference: ({ instructions }: { instructions: unknown[] }) =>
    `instruction-reference:${instructions.length}`,
}));
vi.mock("@/components/reference/CallingConventionGuide", () => ({
  CallingConventionGuide: () => "calling-convention-guide",
}));
vi.mock("@/components/reference/PitfallsCatalog", () => ({
  PitfallsCatalog: () => "pitfalls-catalog",
}));
// The converter marker echoes the view it was opened at, so the fragment
// wiring is visible without the real widget.
vi.mock("@/components/panels/BaseConverter", () => ({
  BaseConverter: ({ view }: { view?: string }) => `base-converter-widget:${view ?? "none"}`,
}));

import type { ReferenceInstruction } from "@/lib/content/reference-data";
import { ReferenceView } from "@/components/reference/ReferenceView";

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
  window.history.replaceState(null, "", "/");
});

// Moves the fragment the way a clicked link or back/forward does; jsdom
// queues its own hashchange, so the event is sent here to keep it in step.
function followFragment(fragment: string): void {
  act(() => {
    window.history.replaceState(null, "", fragment);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

describe("ReferenceView", () => {
  it("renders the four reference tabs with Instructions active by default", () => {
    render(<ReferenceView instructions={INSTRUCTIONS} />);
    expect(
      screen.getByRole("tablist", { name: "reference sections" }),
    ).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Instructions",
      "Calling convention",
      "Pitfalls",
      "Converter",
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

  it("mounts the base converter behind its tab", async () => {
    render(<ReferenceView instructions={INSTRUCTIONS} />);
    fireEvent.click(screen.getByRole("tab", { name: "Converter" }));
    // The widget arrives asynchronously behind next/dynamic.
    expect(await screen.findByText("base-converter-widget:none")).toBeTruthy();
    expect(screen.getByText(/One bit pattern, five readings/)).toBeTruthy();
    expect(
      screen.queryByText(`instruction-reference:${INSTRUCTIONS.length}`),
    ).toBeNull();
  });

  it("opens the converter at the part a fragment names", async () => {
    for (const [fragment, view] of [
      ["#converter", "none"],
      ["#converter-octal", "octal"],
      ["#converter-ieee754", "ieee754"],
    ] as const) {
      window.history.replaceState(null, "", fragment);
      const { unmount } = render(<ReferenceView instructions={INSTRUCTIONS} />);
      expect(
        screen.getByRole("tab", { name: "Converter" }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(await screen.findByText(`base-converter-widget:${view}`)).toBeTruthy();
      unmount();
    }
  });

  it("a converter link followed later wins over a tab pick; other fragments do not", async () => {
    render(<ReferenceView instructions={INSTRUCTIONS} />);
    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));

    // An instruction fragment belongs to the instruction list.
    followFragment("#add");
    expect(screen.getByText("pitfalls-catalog")).toBeTruthy();

    followFragment("#converter-ieee754");
    expect(await screen.findByText("base-converter-widget:ieee754")).toBeTruthy();

    followFragment("#converter-octal");
    expect(await screen.findByText("base-converter-widget:octal")).toBeTruthy();
  });

  it("ignores a fragment that only looks like a key", () => {
    window.history.replaceState(null, "", "#constructor");
    render(<ReferenceView instructions={INSTRUCTIONS} />);
    expect(
      screen.getByRole("tab", { name: "Instructions" }).getAttribute("aria-selected"),
    ).toBe("true");
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
