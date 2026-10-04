import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CodeBlock } from "@/components/ui/CodeBlock";

const SNIPPET = [
  "// add two registers",
  "main:",
  "    mov x0, #1",
  "    add x0, x0, #0x2f",
  "    ret",
].join("\n");

afterEach(() => {
  cleanup();
});

describe("CodeBlock", () => {
  it("colors mnemonics, registers, numbers, comments, and labels from the syntax tokens", () => {
    const { container } = render(<CodeBlock code={SNIPPET} />);
    const html = container.innerHTML;
    expect(html).toContain("var(--syntax-keyword)"); // mov / add / ret
    expect(html).toContain("var(--syntax-register)"); // x0
    expect(html).toContain("var(--syntax-number)"); // #1 / #0x2f
    expect(html).toContain("var(--syntax-comment)"); // // ...
    expect(html).toContain("var(--syntax-label)"); // main:
  });

  it("colors every mnemonic the reference lists", () => {
    // multiply-add, sign/zero-extend, sign-extending loads, pc-relative,
    // compare-and-branch, and the floating-point set color as keywords, like
    // add and ldr.
    const ADDED = [
      "madd", "msub", "sxtb", "sxth", "sxtw", "uxtb", "uxth",
      "ldrsb", "ldrsh", "ldrsw", "adr", "adrp",
      "cbz", "cbnz", "tbz", "tbnz",
      "fmov", "fadd", "fsub", "fmul", "fdiv", "fcmp", "scvtf", "fcvtzs",
    ];
    for (const mnemonic of ADDED) {
      const { unmount } = render(<CodeBlock code={`${mnemonic} d0, d1`} />);
      expect(screen.getByText(mnemonic).className).toContain(
        "var(--syntax-keyword)",
      );
      unmount();
    }
  });

  it("colors quoted strings from the syntax-string token", () => {
    const { container } = render(<CodeBlock code={'msg: .asciz "hello"'} />);
    expect(container.innerHTML).toContain("var(--syntax-string)");
  });

  it("renders code as text, never as injected markup", () => {
    const { container } = render(
      <CodeBlock code={"mov x0, #1 // <img src=x onerror=alert(1)>"} />,
    );
    // the angle-bracket text is rendered literally; no element is created from it
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("leaves an unknown language as plain monospaced text", () => {
    const { container } = render(<CodeBlock code="mov x0, #1" language="text" />);
    expect(container.innerHTML).not.toContain("var(--syntax-keyword)");
    expect(screen.getByText("mov x0, #1")).toBeTruthy();
  });

  // A phone shows no scrollbar until a swipe, so a cut-off line needs a cue.
  it("fades the right edge only while a line runs past it", () => {
    const widths = (scroll: number, client: number) => {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => scroll });
      Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => client });
    };
    const fade = (root: HTMLElement) => root.querySelector('[aria-hidden="true"].bg-gradient-to-l');
    try {
      widths(600, 300);
      const wide = render(<CodeBlock code={SNIPPET} />);
      expect(fade(wide.container)).toBeTruthy();
      wide.unmount();
      widths(300, 300);
      const fits = render(<CodeBlock code={SNIPPET} />);
      expect(fade(fits.container)).toBeNull();
    } finally {
      // The prototype getters are jsdom's zeros; drop the overrides.
      delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });

  it("copies the source to the clipboard on a single click", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CodeBlock code={SNIPPET} />);
    fireEvent.click(screen.getByRole("button", { name: /copy code to clipboard/i }));
    // A single press writes once, with the exact source: no reveal step, no
    // second click needed to land the text on the clipboard.
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(SNIPPET);
  });
});
