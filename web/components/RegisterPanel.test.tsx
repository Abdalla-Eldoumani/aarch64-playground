import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RegisterPanel } from "./RegisterPanel";

const registers = Array.from(
  { length: 31 },
  (_, i) => `0x${i.toString(16).padStart(16, "0")}`,
);

function renderPanel() {
  return render(
    <RegisterPanel
      registers={registers}
      changedRegs={new Set()}
      sp="0x0000fffffffff000"
      pc={0x400000}
      nzcv={0}
    />,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("RegisterPanel", () => {
  it("renders all 31 general registers plus SP and PC with full values", () => {
    renderPanel();
    expect(screen.getByText("X0")).toBeTruthy();
    expect(screen.getByText("X30")).toBeTruthy();
    expect(screen.getByText("SP")).toBeTruthy();
    expect(screen.getByText("PC")).toBeTruthy();
    // Values render whole, never elided: the low digits carry the meaning.
    expect(screen.getByText("0x0000000000000000")).toBeTruthy();
    expect(screen.getByText("0x000000000000001e")).toBeTruthy();
    expect(screen.getByText("0x0000fffffffff000")).toBeTruthy();
  });

  it("cross-references the ABI aliases beside the register names", () => {
    renderPanel();
    expect(screen.getByText("arg0")).toBeTruthy();
    expect(screen.getByText("fp")).toBeTruthy();
    expect(screen.getByText("lr")).toBeTruthy();
  });

  it("sizes the register columns to the panel, not the viewport", () => {
    const { container } = renderPanel();
    const grid = container.querySelector('[class*="auto-fill"]');
    // A second column may appear only when two full rows fit the panel's own
    // width; a viewport rule cannot know how wide the host made the panel.
    expect(grid).not.toBeNull();
    expect(grid!.className).not.toContain("sm:grid-cols-2");
    expect(grid!.className).toContain("min(16.5rem,100%)");
  });
});
