// Pins the narrow frame's view switch: which pane the grid is told to show,
// that a blocked read or a finished run with output brings the console
// forward, and the status line's peek at the last write. The switch is shown
// only by a container query, which jsdom cannot evaluate, so the tests read
// the grid's data-pane instead of what is painted. Also the registers or
// stack choice a frame that steps offers, and that it is remembered; and the
// slot a pointer chip lights, let go when a run starts.
import { useContext } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmbedLayout, type EmbedLayoutProps } from "@/components/playground/EmbedLayout";
import { PointerContext } from "@/components/panels/slot-pointer";

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
    onRunUntil: vi.fn(),
    stopReason: null,
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

describe("EmbedLayout's step over, step out and run to cursor", () => {
  test("sends each goal from its own button", async () => {
    const p = props();
    render(<EmbedLayout {...p} />);
    fireEvent.click(await screen.findByRole("button", { name: "step over" }));
    fireEvent.click(screen.getByRole("button", { name: "step out" }));
    fireEvent.click(screen.getByRole("button", { name: "run to cursor" }));
    expect(vi.mocked(p.onRunUntil).mock.calls).toEqual([["over"], ["out"], ["cursor"]]);
  });

  test("a frame that cannot step (the landing demo) has none of them", () => {
    render(<EmbedLayout {...props({ showStep: false })} />);
    expect(screen.queryByRole("button", { name: "more ways to step" })).toBeNull();
    expect(screen.queryByRole("button", { name: "step over" })).toBeNull();
  });

  test("the ellipsis opens their row in a one-pane frame and is remembered", async () => {
    render(<EmbedLayout {...props()} />);
    const more = await screen.findByRole("button", { name: "more ways to step" });
    const row = document.getElementById(more.getAttribute("aria-controls")!)!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(row.hasAttribute("data-open")).toBe(false);
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(row.hasAttribute("data-open")).toBe(true);
    expect(window.localStorage.getItem("aarch64-playground:embed-more")).toBe("1");
  });

  test("they wait while step would", async () => {
    render(<EmbedLayout {...props({ canStep: false })} />);
    expect(await screen.findByRole("button", { name: "step over" })).toHaveProperty("disabled", true);
  });

  test("says why the last one stopped, politely, unless an error says more", () => {
    const { rerender } = render(<EmbedLayout {...props({ stopReason: "stopped at the breakpoint on line 30" })} />);
    expect(screen.getByText("stopped at the breakpoint on line 30").getAttribute("role")).toBe("status");
    rerender(<EmbedLayout {...props({ stopReason: "stopped at the breakpoint on line 30", error: "memory fault" })} />);
    expect(screen.queryByText("stopped at the breakpoint on line 30")).toBeNull();
  });
});

describe("a pointer chip's slot", () => {
  // Stand-ins for the register panel's chip and the frames view's lit slot,
  // each reading the frame's own pointer as the real ones do.
  function Chip() {
    const point = useContext(PointerContext)?.point;
    return (
      <button type="button" onFocus={() => point?.(2)} onClick={() => point?.(2, true)}>
        x2 chip
      </button>
    );
  }
  function Lit() {
    const pointed = useContext(PointerContext)?.pointed;
    return <output aria-label="lit slot">{pointed ? `x${pointed.reg}` : "none"}</output>;
  }
  const frame = (isRunning: boolean) => (
    <EmbedLayout
      {...props({
        registers: (
          <>
            <Chip />
            <Lit />
          </>
        ),
        stack: <Lit />,
        isRunning,
        runStatus: { ...STATUS, isRunning },
      })}
    />
  );
  const lit = () => screen.getByRole("status", { name: "lit slot" }).textContent;

  // A run unmounts the chips, and no blur or leave tells the frame.
  test("lets go of a focused chip's slot when a run starts", () => {
    const { rerender } = render(frame(false));
    fireEvent.focus(screen.getByRole("button", { name: "x2 chip" }));
    expect(lit()).toBe("x2");
    rerender(frame(true));
    expect(lit()).toBe("none");
    rerender(frame(false));
    expect(lit()).toBe("none");
  });

  // The press swaps the registers, chip and all, for the stack, so nothing
  // in the register panel is left to see the run start.
  test("lets go of a pressed chip's slot when a run starts from the stack it opened", () => {
    const { rerender } = render(frame(false));
    fireEvent.click(screen.getByRole("button", { name: "x2 chip" }));
    expect(screen.queryByRole("button", { name: "x2 chip" })).toBeNull();
    expect(lit()).toBe("x2");
    rerender(frame(true));
    expect(lit()).toBe("none");
    rerender(frame(false));
    expect(lit()).toBe("none");
  });
});
