// Pins the narrow frame's view switch: which pane the grid is told to show,
// that a blocked read or a finished run with output brings the console
// forward, and the status line's peek at the last write. The switch is shown
// only by a container query, which jsdom cannot evaluate, so the tests read
// the grid's data-pane instead of what is painted.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmbedLayout, type EmbedLayoutProps } from "@/components/playground/EmbedLayout";

afterEach(() => cleanup());

const STATUS: EmbedLayoutProps["runStatus"] = {
  programLoaded: true,
  isRunning: false,
  isHalted: false,
  blocked: false,
  exitCode: null,
  stepCount: 2,
  failed: false,
  registers: ["0x0", "0x0", "0x5"],
  sp: "0x0",
  changedRegs: new Set([2]),
};

function props(over: Partial<EmbedLayoutProps> = {}): EmbedLayoutProps {
  return {
    editor: <textarea aria-label="assembly source" />,
    registers: <div data-testid="regs" />,
    console: <div data-testid="con" />,
    showRun: true,
    showReset: true,
    showStep: true,
    showBack: true,
    showCheck: false,
    isRunning: false,
    canStep: true,
    canStepBack: false,
    error: null,
    onRun: vi.fn(),
    onReset: vi.fn(),
    onStep: vi.fn(),
    onStepBack: vi.fn(),
    onCheck: vi.fn(),
    runStatus: STATUS,
    hasOutput: false,
    ...over,
  };
}

const grid = () => document.querySelector(".embed-grid") as HTMLElement;
const view = () => screen.getByRole("group", { name: "view" });

describe("EmbedLayout's narrow view switch", () => {
  test("offers code, registers, and console, opening on the code", () => {
    render(<EmbedLayout {...props()} />);
    expect(within(view()).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "code",
      "registers",
      "console",
    ]);
    expect(grid().dataset.pane).toBe("editor");
    for (const b of within(view()).getAllByRole("button")) expect(b.className).toContain("h-11");
  });

  test("a press shows that pane, and the peek opens the registers", () => {
    render(<EmbedLayout {...props()} />);
    fireEvent.click(within(view()).getByRole("button", { name: "console" }));
    expect(grid().dataset.pane).toBe("console");
    fireEvent.click(screen.getByRole("button", { name: /last step wrote x2 = 0x5/ }));
    expect(grid().dataset.pane).toBe("registers");
  });

  test("a read that blocks brings the console forward", () => {
    const { rerender } = render(<EmbedLayout {...props()} />);
    rerender(<EmbedLayout {...props({ runStatus: { ...STATUS, blocked: true } })} />);
    expect(grid().dataset.pane).toBe("console");
  });

  test("a run that finishes having printed brings the console forward", () => {
    const { rerender } = render(<EmbedLayout {...props({ isRunning: true })} />);
    rerender(
      <EmbedLayout
        {...props({ isRunning: false, hasOutput: true, runStatus: { ...STATUS, isHalted: true, exitCode: 0 } })}
      />,
    );
    expect(grid().dataset.pane).toBe("console");
  });

  test("a run that finishes silently leaves the code on screen", () => {
    const { rerender } = render(<EmbedLayout {...props({ isRunning: true })} />);
    rerender(<EmbedLayout {...props({ runStatus: { ...STATUS, isHalted: true, exitCode: 0 } })} />);
    expect(grid().dataset.pane).toBe("editor");
  });
});
