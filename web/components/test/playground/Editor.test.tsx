// Pins the phone fallback editor (under 480px, Monaco is replaced by a
// textarea plus a synced gutter): the gutter numbers every line of a real
// program, follows the textarea's scroll, renders a bounded number of rows no
// matter how many lines the buffer carries, and is one 44px-wide control
// that toggles the tapped line or, from the keyboard, the caret's line.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@/components/playground/Editor";

function narrowViewport(): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 375,
  });
}

function renderFallback(
  value: string,
  { breakpoints = new Set<number>(), onToggleBreakpoint = () => {} } = {},
) {
  narrowViewport();
  return render(
    <Editor
      value={value}
      onChange={() => {}}
      currentLine={null}
      breakpoints={breakpoints}
      onToggleBreakpoint={onToggleBreakpoint}
      assemblyErrors={[]}
    />,
  );
}

/** The line number each gutter row stands for. */
function gutterLines(): number[] {
  return Array.from(document.querySelectorAll("[data-gutter-line]")).map((row) =>
    Number(row.getAttribute("data-gutter-line")),
  );
}

function gutter(): HTMLElement {
  return screen.getByRole("button", { name: /^breakpoints/ });
}

/** jsdom gives every element a zero scrollTop and clientHeight, and a plain
 *  `value` descriptor is read-only, but the reveal has to write scrollTop. */
function makeScrollable(el: HTMLElement, clientHeight: number): void {
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (next: number) => {
      top = next;
    },
  });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
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

  it("reveals the pc line by the nearest scroll, and leaves a visible one alone", () => {
    narrowViewport();
    const program = Array.from({ length: 200 }, (_, i) => `  mov x0, ${i}`).join("\n");
    const { rerender } = render(
      <Editor
        value={program}
        onChange={() => {}}
        currentLine={null}
        breakpoints={new Set<number>()}
        onToggleBreakpoint={() => {}}
        assemblyErrors={[]}
      />,
    );
    const textarea = screen.getByLabelText("assembly source");
    makeScrollable(textarea, 240);

    const withLine = (line: number) =>
      rerender(
        <Editor
          value={program}
          onChange={() => {}}
          currentLine={line}
          breakpoints={new Set<number>()}
          onToggleBreakpoint={() => {}}
          assemblyErrors={[]}
        />,
      );

    // Line 60 starts at 12 + 59*24 = 1428 and ends at 1452; the nearest
    // scroll that brings its bottom into a 240px window is 1212. Centring
    // would land on 1308.
    withLine(60);
    expect(textarea.scrollTop).toBe(1212);

    // Line 59 is already inside the window, so the buffer must not move.
    withLine(59);
    expect(textarea.scrollTop).toBe(1212);
  });

  it("holds the pc reveal while following is off, and reveals once it turns on", () => {
    // An assemble puts the pc on the entry line before the first step; the
    // student's scroll has to stay where it is until then.
    narrowViewport();
    const program = Array.from({ length: 200 }, (_, i) => `  mov x0, ${i}`).join("\n");
    const at = (follow: boolean) => (
      <Editor
        value={program}
        onChange={() => {}}
        currentLine={60}
        breakpoints={new Set<number>()}
        onToggleBreakpoint={() => {}}
        assemblyErrors={[]}
        followCurrentLine={follow}
      />
    );
    const { rerender } = render(at(false));
    const textarea = screen.getByLabelText("assembly source");
    makeScrollable(textarea, 240);
    rerender(at(false));
    expect(textarea.scrollTop).toBe(0);
    rerender(at(true));
    expect(textarea.scrollTop).toBe(1212);
  });

  it("jumps to a requested error line: centred, caret at its start, focused", () => {
    narrowViewport();
    const program = Array.from({ length: 200 }, (_, i) => `  mov x0, ${i}`).join("\n");
    const at = (request: { line: number; nonce: number } | null) => (
      <Editor
        value={program}
        onChange={() => {}}
        currentLine={null}
        breakpoints={new Set<number>()}
        onToggleBreakpoint={() => {}}
        assemblyErrors={[]}
        focusRequest={request}
      />
    );
    const { rerender } = render(at(null));
    const textarea = screen.getByLabelText("assembly source") as HTMLTextAreaElement;
    makeScrollable(textarea, 240);
    rerender(at({ line: 76, nonce: 1 }));
    // Line 76 starts at 12 + 75*24 = 1812; centred in 240px: 1812 - 108.
    expect(textarea.scrollTop).toBe(1704);
    expect(document.activeElement).toBe(textarea);
    // Each earlier line is "  mov x0, N" plus its newline.
    const start = program.split("\n").slice(0, 75).join("\n").length + 1;
    expect(textarea.selectionStart).toBe(start);
    expect(textarea.selectionEnd).toBe(start);
  });

  it("does not replay a jump that was already requested when it mounted", () => {
    narrowViewport();
    render(
      <Editor
        value={"  mov x0, 1\n".repeat(100)}
        onChange={() => {}}
        currentLine={null}
        breakpoints={new Set<number>()}
        onToggleBreakpoint={() => {}}
        assemblyErrors={[]}
        focusRequest={{ line: 90, nonce: 3 }}
      />,
    );
    expect(document.activeElement).not.toBe(screen.getByLabelText("assembly source"));
  });

  it("keeps the numbers on the lines the window actually shows", () => {
    renderFallback("\n".repeat(49_999));
    scrollTo(24_000);
    const first = document.querySelector("[data-gutter-line]");
    expect(first?.textContent).toBe(String(gutterLines()[0]));
  });

  it("toggles the line under a tap, counting the textarea's scroll", () => {
    const onToggleBreakpoint = vi.fn();
    renderFallback("\n".repeat(99), { onToggleBreakpoint });
    scrollTo(240);
    // 12px of padding, then 24px lines: 60px down the gutter is line 3, and
    // scrolled ten lines it is line 13.
    vi.spyOn(gutter(), "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 44, 400));
    fireEvent.click(gutter(), { clientY: 160, detail: 1 });
    expect(onToggleBreakpoint).toHaveBeenCalledWith(13);
  });

  it("toggles the caret's line from the keyboard and names the set lines", () => {
    const onToggleBreakpoint = vi.fn();
    renderFallback("mov x0, 1\nmov x1, 2\nmov x2, 3", {
      breakpoints: new Set([1, 3]),
      onToggleBreakpoint,
    });
    expect(gutter().getAttribute("aria-label")).toMatch(/^breakpoints on lines 1, 3:/);
    const textarea = screen.getByLabelText("assembly source") as HTMLTextAreaElement;
    textarea.setSelectionRange(12, 12);
    fireEvent.click(gutter(), { detail: 0 });
    expect(onToggleBreakpoint).toHaveBeenCalledWith(2);
  });
});
