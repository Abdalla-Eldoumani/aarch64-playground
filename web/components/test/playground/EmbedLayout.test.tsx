// Pins the narrow frame's view switch: which pane the grid is told to show,
// that a blocked read or a finished run with output brings the console
// forward, and the status line's peek at the last write. The switch is shown
// only by a container query, which jsdom cannot evaluate, so the tests read
// the grid's data-pane instead of what is painted. Also the registers or
// stack choice a frame that steps offers, and that it is remembered.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmbedLayout, type EmbedLayoutProps } from "@/components/playground/EmbedLayout";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

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
    stack: <div data-testid="frames" />,
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
  test("offers code, registers, stack, and console, opening on the code", () => {
    render(<EmbedLayout {...props()} />);
    expect(within(view()).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "code",
      "registers",
      "stack",
      "console",
    ]);
    expect(grid().dataset.pane).toBe("editor");
  });

  test("a frame that cannot step (the landing demo) offers no stack", () => {
    render(<EmbedLayout {...props({ showStep: false })} />);
    expect(within(view()).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "code",
      "registers",
      "console",
    ]);
    expect(screen.queryByRole("group", { name: "registers or stack" })).toBeNull();
  });

  test("its stack shows the frames in the registers' pane", () => {
    render(<EmbedLayout {...props()} />);
    fireEvent.click(within(view()).getByRole("button", { name: "stack" }));
    expect(grid().dataset.pane).toBe("registers");
    expect(screen.getByTestId("frames")).toBeTruthy();
    expect(screen.queryByTestId("regs")).toBeNull();
    const pressed = within(view())
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map((b) => b.textContent)).toEqual(["stack"]);
  });

  test("a press shows that pane, and the peek opens the registers", () => {
    render(<EmbedLayout {...props()} />);
    fireEvent.click(within(view()).getByRole("button", { name: "console" }));
    expect(grid().dataset.pane).toBe("console");
    fireEvent.click(screen.getByRole("button", { name: /last step wrote x2 = 0x5/ }));
    expect(grid().dataset.pane).toBe("registers");
  });

  test("the peek opens the registers even with the stack picked", () => {
    render(<EmbedLayout {...props()} />);
    fireEvent.click(within(view()).getByRole("button", { name: "stack" }));
    fireEvent.click(screen.getByRole("button", { name: /last step wrote x2 = 0x5/ }));
    expect(screen.getByTestId("regs")).toBeTruthy();
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

describe("the registers or stack switch beside the registers", () => {
  const side = () => screen.getByRole("group", { name: "registers or stack" });

  test("opens on the registers", () => {
    render(<EmbedLayout {...props()} />);
    expect(screen.getByTestId("regs")).toBeTruthy();
    expect(within(side()).getByRole("button", { name: "registers" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("shows the frames on a press and remembers it for the next frame", () => {
    render(<EmbedLayout {...props()} />);
    fireEvent.click(within(side()).getByRole("button", { name: "stack" }));
    expect(screen.getByTestId("frames")).toBeTruthy();
    expect(window.localStorage.getItem("aarch64-playground:embed-stack")).toBe("1");
    cleanup();
    render(<EmbedLayout {...props()} />);
    expect(screen.getByTestId("frames")).toBeTruthy();
    fireEvent.click(within(side()).getByRole("button", { name: "registers" }));
    expect(window.localStorage.getItem("aarch64-playground:embed-stack")).toBe("0");
  });

  // A lesson page holds several editors; the choice is one per viewer, so
  // every frame on the page switches with the one pressed, and keeps it.
  test("switches every frame on the page at once, and they all reopen on it", () => {
    const pair = () =>
      render(
        <>
          <EmbedLayout {...props({ registers: <div data-testid="regs-a" />, stack: <div data-testid="frames-a" /> })} />
          <EmbedLayout {...props({ registers: <div data-testid="regs-b" />, stack: <div data-testid="frames-b" /> })} />
        </>,
      );
    pair();
    const [first, second] = screen.getAllByRole("group", { name: "registers or stack" });
    fireEvent.click(within(first).getByRole("button", { name: "stack" }));
    expect(screen.getByTestId("frames-a")).toBeTruthy();
    expect(screen.getByTestId("frames-b")).toBeTruthy();
    expect(within(second).getByRole("button", { name: "stack" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(second).getByRole("button", { name: "registers" }));
    expect(screen.getByTestId("regs-a")).toBeTruthy();
    expect(screen.getByTestId("regs-b")).toBeTruthy();
    fireEvent.click(within(first).getByRole("button", { name: "stack" }));
    cleanup();
    pair();
    expect(screen.getByTestId("frames-a")).toBeTruthy();
    expect(screen.getByTestId("frames-b")).toBeTruthy();
  });

  // The browser tells a page when another of its tabs writes the key.
  test("follows a choice made in another tab", () => {
    render(<EmbedLayout {...props()} />);
    act(() => {
      window.localStorage.setItem("aarch64-playground:embed-stack", "1");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "aarch64-playground:embed-stack", newValue: "1", storageArea: window.localStorage }),
      );
    });
    expect(screen.getByTestId("frames")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "aarch64-playground:theme", newValue: "0" }));
    });
    expect(screen.getByTestId("frames")).toBeTruthy();
  });

  test("keeps the registers when storage throws", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<EmbedLayout {...props()} />);
    expect(screen.getByTestId("regs")).toBeTruthy();
    fireEvent.click(within(side()).getByRole("button", { name: "stack" }));
    expect(screen.getByTestId("frames")).toBeTruthy();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("the error line", () => {
  // A phone has no hover to read a title, so the whole message is the line's
  // own text and the line never ends in an ellipsis; the wrap itself is
  // measured in the browser pass, since jsdom does no layout.
  test("carries the whole message and is never truncated", () => {
    const message =
      "immediate out of range: 0-4095, or a multiple of 4096 up to 16773120 (which encodes as lsl #12)";
    render(<EmbedLayout {...props({ error: message })} />);
    const line = screen.getByRole("alert");
    expect(line.textContent).toBe(message);
    expect(line.className).not.toMatch(/\btruncate\b/);
    expect(line.className).toMatch(/\bbreak-words\b/);
  });
});
