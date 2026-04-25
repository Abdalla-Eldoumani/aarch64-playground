import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MobileLayout } from "@/components/MobileLayout";

afterEach(() => cleanup());

const allBlocks = {
  editor: <div data-testid="ed" />,
  disassembly: <div />,
  registers: <div />,
  memory: <div />,
  stack: <div />,
  console: <div />,
  watches: <div />,
  memwatch: <div />,
  saves: <div />,
};

describe("MobileLayout", () => {
  test("tab strip is the last child of the root", () => {
    const { container } = render(<MobileLayout {...allBlocks} />);
    const root = container.firstChild as HTMLElement;
    const last = root.lastChild as HTMLElement;
    expect(last.getAttribute("role")).toBe("tablist");
  });

  test("renders nine tabs in canonical order", () => {
    const { getAllByRole } = render(<MobileLayout {...allBlocks} />);
    const labels = getAllByRole("tab").map((t) => t.textContent?.trim());
    expect(labels).toEqual([
      "code",
      "disasm",
      "regs",
      "mem",
      "stack",
      "i/o",
      "watches",
      "memwatch",
      "saves",
    ]);
  });
});
