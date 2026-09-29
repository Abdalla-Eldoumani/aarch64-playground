// Pins the static hero code view: the gutter, the ONE-based current line (the
// hub's numbering, not CodeBlock's zero-based one), scrolling to that line,
// and the shared highlighter's colors.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

  it("lets a keyboard reach the scroll box, which holds no control of its own", () => {
    render(<StaticCodeView value={"a\nb\nc"} currentLine={null} />);
    const box = screen.getByRole("group", { name: "program source" });
    expect(box.getAttribute("tabindex")).toBe("0");
    box.focus();
    expect(document.activeElement).toBe(box);
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

  it("scrolls only its own box to the current line, never the page", () => {
    // scrollIntoView moved the whole page on a phone: the landing's autoplay
    // pulled a reader who had scrolled on back up to the hero.
    const program = "a\nb\nc\nd";
    const { container, rerender } = render(<StaticCodeView value={program} currentLine={1} />);
    const box = container.firstElementChild as HTMLElement;
    let top = 0;
    Object.defineProperty(box, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (next: number) => {
        top = next;
      },
    });
    Object.defineProperty(box, "clientHeight", { configurable: true, value: 42 });
    rows(container).forEach((row, i) => {
      Object.defineProperty(row, "offsetTop", { configurable: true, value: i * 21 });
      Object.defineProperty(row, "offsetHeight", { configurable: true, value: 21 });
    });
    // Line 4 spans 63 to 84; the nearest scroll that shows it in a 42px box
    // is 42.
    rerender(<StaticCodeView value={program} currentLine={4} />);
    expect(box.scrollTop).toBe(42);
    // Line 3 (42 to 63) is already in view, so the box holds still.
    rerender(<StaticCodeView value={program} currentLine={3} />);
    expect(box.scrollTop).toBe(42);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("colors a mnemonic through the shared highlighter", () => {
    const { container } = render(<StaticCodeView value="        mov x0, 1" currentLine={null} />);
    const keyword = container.querySelector(".text-\\[var\\(--syntax-keyword\\)\\]");
    expect(keyword?.textContent).toBe("mov");
  });
});
