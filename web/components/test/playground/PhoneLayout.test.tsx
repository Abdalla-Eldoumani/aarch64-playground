// Pins the phone layout: four tabs upright (three on its side, where the code
// is always showing), the editor kept mounted and only hidden behind another
// view, the status line with its register peek, host pane requests, the
// console's waiting dot, and a tab choice that survives a rotation.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PhoneLayout, type PhoneLayoutProps } from "@/components/playground/PhoneLayout";

afterEach(() => cleanup());

const PANES = {
  memory: <div data-testid="mem" />,
  stack: <div data-testid="stack" />,
  console: <div data-testid="con" />,
  terminal: <div data-testid="term" />,
  watches: <div data-testid="watch" />,
  converter: <div data-testid="conv" />,
  memwatch: <div data-testid="memwatch" />,
  saves: <div data-testid="saves" />,
};

const STATUS: PhoneLayoutProps["runStatus"] = {
  programLoaded: true,
  isRunning: false,
  isHalted: false,
  blocked: false,
  exitCode: null,
  stepCount: 3,
  failed: false,
  registers: ["0x0", "0x2f"],
  sp: "0x7ffff0",
  changedRegs: new Set([1]),
};

function props(over: Partial<PhoneLayoutProps> = {}): PhoneLayoutProps {
  return {
    shape: "portrait",
    editor: <textarea aria-label="assembly source" defaultValue="mov x0, 1" />,
    disassembly: <div data-testid="disasm" />,
    registers: <div data-testid="regs" />,
    panes: PANES,
    controls: <div data-testid="controls" />,
    runStatus: STATUS,
    consoleBlocked: false,
    consoleUnread: false,
    ...over,
  };
}

const strip = () => screen.getByRole("tablist", { name: "playground view" });
const tabNames = () => within(strip()).getAllByRole("tab").map((t) => t.textContent?.trim());

describe("PhoneLayout", () => {
  test("upright, the tabs are code, registers, console, and more", () => {
    render(<PhoneLayout {...props()} />);
    expect(tabNames()).toEqual(["code", "registers", "console", "more"]);
  });

  test("on its side the code tab goes, since the code is always on screen", () => {
    render(<PhoneLayout {...props({ shape: "landscape" })} />);
    expect(tabNames()).toEqual(["registers", "console", "more"]);
    // The view beside the code falls back to the registers.
    expect(screen.getByTestId("regs")).toBeTruthy();
    expect(screen.getByLabelText("assembly source")).toBeTruthy();
  });

  test("another view hides the editor without unmounting it", () => {
    render(<PhoneLayout {...props()} />);
    const editor = screen.getByLabelText("assembly source");
    fireEvent.click(within(strip()).getByRole("tab", { name: "console" }));
    expect(screen.getByTestId("con")).toBeTruthy();
    expect(screen.getByLabelText("assembly source")).toBe(editor);
    expect(editor.parentElement?.className).toContain("invisible");
  });

  test("the chosen tab survives a turn of the phone", () => {
    const { rerender } = render(<PhoneLayout {...props()} />);
    fireEvent.click(within(strip()).getByRole("tab", { name: "console" }));
    rerender(<PhoneLayout {...props({ shape: "landscape" })} />);
    expect(within(strip()).getByRole("tab", { name: "console" }).getAttribute("aria-selected")).toBe("true");
    rerender(<PhoneLayout {...props()} />);
    expect(within(strip()).getByRole("tab", { name: "console" }).getAttribute("aria-selected")).toBe("true");
  });

  test("the status line peeks at the last write and opens the registers", () => {
    render(<PhoneLayout {...props()} />);
    const peek = screen.getByRole("button", { name: /last step wrote x1 = 0x2f/ });
    expect(screen.getByRole("status").textContent).toBe("3 steps");
    fireEvent.click(peek);
    expect(screen.getByTestId("regs")).toBeTruthy();
    // With the registers on screen the peek has nothing to add.
    expect(screen.queryByRole("button", { name: /last step wrote/ })).toBeNull();
  });

  test("says when a run finished and how", () => {
    render(<PhoneLayout {...props({ runStatus: { ...STATUS, isHalted: true, exitCode: 0, stepCount: 55 } })} />);
    expect(screen.getByRole("status").textContent).toBe("finished · exit 0 · 55 steps");
  });

  test("a host request brings a view under more forward", () => {
    const { rerender } = render(<PhoneLayout {...props()} />);
    expect(screen.queryByTestId("conv")).toBeNull();
    rerender(<PhoneLayout {...props({ paneRequest: { pane: "convert", nonce: 1 } })} />);
    expect(screen.getByTestId("conv")).toBeTruthy();
    expect(within(strip()).getByRole("tab", { name: "more" }).getAttribute("aria-selected")).toBe("true");
    // The strip still works by hand after a request.
    fireEvent.click(within(strip()).getByRole("tab", { name: "code" }));
    expect(screen.queryByTestId("conv")).toBeNull();
  });

  test("reports the view on screen to the host", () => {
    const onPaneShown = vi.fn();
    render(<PhoneLayout {...props({ onPaneShown })} />);
    expect(onPaneShown).toHaveBeenLastCalledWith("code");
    fireEvent.click(within(strip()).getByRole("tab", { name: "console" }));
    expect(onPaneShown).toHaveBeenLastCalledWith("console");
  });

  test("marks the console tab while the program waits for input", () => {
    render(<PhoneLayout {...props({ consoleBlocked: true })} />);
    expect(within(strip()).getByRole("tab", { name: "console, waiting for input" })).toBeTruthy();
  });

  test("keeps the terminal mounted once opened, so a session survives a switch", () => {
    const { rerender } = render(<PhoneLayout {...props()} />);
    rerender(<PhoneLayout {...props({ paneRequest: { pane: "term", nonce: 1 } })} />);
    const term = screen.getByTestId("term");
    fireEvent.click(within(strip()).getByRole("tab", { name: "code" }));
    expect(screen.getByTestId("term")).toBe(term);
  });
});
