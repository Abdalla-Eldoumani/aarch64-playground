// Pins the phone fallback editor (under 480px, Monaco is replaced by a
// textarea plus a synced gutter): the gutter numbers every line of a real
// program, follows the textarea's scroll, and commits a bounded number of
// buttons no matter how many lines the buffer carries.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@/components/playground/Editor";

function narrowViewport(): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 375,
  });
}

function renderFallback(value: string) {
  narrowViewport();
  return render(
    <Editor
      value={value}
      onChange={() => {}}
      currentLine={null}
      breakpoints={new Set<number>()}
      onToggleBreakpoint={() => {}}
      assemblyErrors={[]}
    />,
  );
}

/** The line number each gutter button stands for, read off its label. */
function gutterLines(): number[] {
  return screen
    .getAllByRole("button")
    .map((b) => Number(/^line (\d+)/.exec(b.getAttribute("aria-label") ?? "")?.[1]));
}

function scrollTo(pixels: number): void {
  const textarea = screen.getByLabelText("assembly source");
  Object.defineProperty(textarea, "scrollTop", { configurable: true, value: pixels });
  fireEvent.scroll(textarea);
}

describe("Editor fallback gutter", () => {
  afterEach(() => {
    cleanup();
  });

  it("numbers every line of a program that fits on screen", () => {
    renderFallback(Array.from({ length: 40 }, (_, i) => `  mov x0, ${i}`).join("\n"));
    const lines = gutterLines();
    expect(lines).toHaveLength(40);
    expect(lines[0]).toBe(1);
    expect(lines[39]).toBe(40);
  });

  it("bounds the gutter no matter how many lines the buffer has", () => {
    // A share link may hand the editor a 1 MB buffer, and 1 MB of bare
    // newlines is over a million lines. One button per line froze the tab
    // on the first paint, before the student touched anything.
    renderFallback("\n".repeat(49_999));
    const lines = gutterLines();
    expect(lines.length).toBeLessThan(300);
    expect(lines[0]).toBe(1);
  });

  it("follows the textarea's scroll so the numbers stay correct", () => {
    renderFallback("\n".repeat(49_999));
    // 24px lines: 24000px down puts line 1000 at the top of the view.
    scrollTo(24_000);
    const lines = gutterLines();
    expect(lines.length).toBeLessThan(300);
    expect(lines[0]).toBeGreaterThan(1);
    expect(lines[0]).toBeLessThanOrEqual(1_000);
    // A screenful below the scroll position is drawn too, so a flick does
    // not expose a blank strip.
    expect(lines[lines.length - 1]).toBeGreaterThanOrEqual(1_040);
  });

  it("keeps breakpoint labels on the lines the window actually shows", () => {
    renderFallback("\n".repeat(49_999));
    scrollTo(24_000);
    const first = screen.getAllByRole("button")[0];
    expect(first.getAttribute("aria-label")).toBe(
      `line ${gutterLines()[0]}, tap to set breakpoint`,
    );
    expect(first.textContent).toBe(String(gutterLines()[0]));
  });
});
