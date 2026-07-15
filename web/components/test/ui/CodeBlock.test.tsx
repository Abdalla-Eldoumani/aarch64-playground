import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CodeBlock } from "@/components/ui/CodeBlock";

const THEMES = ["dark", "light", "high-contrast"] as const;

const SNIPPET = [
  "// add two registers",
  "main:",
  "    mov x0, #1",
  "    add x0, x0, #0x2f",
  "    ret",
].join("\n");

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
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

  it("colors every mnemonic the reference newly showcases", () => {
    // multiply-add, sign/zero-extend, sign-extending loads, pc-relative,
    // compare-and-branch, and the floating-point set now color as keywords
    // instead of rendering as plain text alongside add / ldr.
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

  it("renders read-only in the mono family on a surface token", () => {
    const { container } = render(<CodeBlock code="ret" />);
    const pre = container.querySelector("pre");
    expect(pre?.className).toContain("font-mono");
    expect(pre?.className).toContain("bg-[var(--bg-sunken)]");
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

  it("renders the keyword token under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { container, unmount } = render(<CodeBlock code="mov x0, #1" />);
      expect(container.innerHTML).toContain("var(--syntax-keyword)");
      unmount();
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
