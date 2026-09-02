// Pins the static hero code view: the gutter, the ONE-based current line (the
// hub's numbering, not CodeBlock's zero-based one), the editor's metrics and
// current-line treatment, the reveal, and the shared highlighter's colors.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StaticCodeView } from "@/components/playground/StaticCodeView";

// jsdom implements no scrollIntoView, so every render that marks a line needs
// the stub, not just the case that asserts on it.
const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
});

const rows = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-line]"));

describe("StaticCodeView", () => {
  it("renders one gutter number per line, starting at 1", () => {
    const { container } = render(<StaticCodeView value={"a\nb\nc"} currentLine={null} />);
    expect(
      rows(container).map((row) => row.querySelector("[aria-hidden]")?.textContent),
    ).toEqual(["1", "2", "3"]);
  });

  it("marks the one-based currentLine, not the line at that index", () => {
    const { container } = render(<StaticCodeView value={"a\nb\nc"} currentLine={2} />);
    const marked = container.querySelectorAll("[data-current]");
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute("data-line")).toBe("2");
    expect(marked[0].textContent).toBe("2b");
  });

  it("marks nothing when currentLine is null", () => {
    const { container } = render(<StaticCodeView value={"a\nb"} currentLine={null} />);
    expect(container.querySelectorAll("[data-current]")).toHaveLength(0);
  });

  it("uses the editor's 14px on 21px metrics, not CodeBlock's 13px", () => {
    const { container } = render(<StaticCodeView value="mov x0, 1" currentLine={null} />);
    const pre = container.querySelector("pre");
    expect(pre?.className).toContain("text-[14px]");
    expect(pre?.className).toContain("leading-[21px]");
    expect(pre?.className).toContain("font-mono");
  });

  it("wears the editor's current-line treatment, 14% amber behind a 2px rule", () => {
    const { container } = render(<StaticCodeView value={"a\nb"} currentLine={1} />);
    const marked = container.querySelector("[data-current]");
    expect(marked?.className).toContain("--amber)_14%");
    expect(marked?.className).toContain("inset_2px");
  });

  it("scrolls the current line into view when it changes", () => {
    const { rerender } = render(<StaticCodeView value={"a\nb\nc"} currentLine={1} />);
    scrollIntoView.mockClear();
    rerender(<StaticCodeView value={"a\nb\nc"} currentLine={3} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("colors a mnemonic through the shared highlighter", () => {
    const { container } = render(<StaticCodeView value="        mov x0, 1" currentLine={null} />);
    const keyword = container.querySelector(".text-\\[var\\(--syntax-keyword\\)\\]");
    expect(keyword?.textContent).toBe("mov");
  });
});
