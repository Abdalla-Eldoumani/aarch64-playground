import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Controls } from "@/components/playground/Controls";

afterEach(() => cleanup());

const allHandlers = () => ({
  onAssemble: vi.fn(),
  onStep: vi.fn(),
  onStepBack: vi.fn(),
  onRun: vi.fn(),
  onPause: vi.fn(),
  onReset: vi.fn(),
});

describe("Controls", () => {
  it("counts one step in the singular and more in the plural", () => {
    const h = allHandlers();
    const props = {
      ...h,
      canStepBack: true,
      isRunning: false,
      isHalted: false,
      programLoaded: true,
      error: null,
    };
    const { rerender } = render(<Controls {...props} stepCount={1} />);
    expect(screen.getByText("1 step")).toBeTruthy();
    expect(screen.getByLabelText("1 instruction executed")).toBeTruthy();
    rerender(<Controls {...props} stepCount={2} />);
    expect(screen.getByText("2 steps")).toBeTruthy();
  });

  it("keeps the error out of the button row", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error="undefined label: mian"
      />,
    );
    const row = screen.getByRole("button", { name: "assemble" }).parentElement!;
    expect(row.querySelectorAll("button")).toHaveLength(5);
    const alert = screen.getByRole("alert");
    expect(row.contains(alert)).toBe(false);
    expect(alert.parentElement).toBe(row.parentElement);
  });

  it("gives a phone the five buttons and no step status or key hints", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        compact
        canStepBack={false}
        isRunning={false}
        isHalted={true}
        programLoaded={true}
        stepCount={12}
        error={null}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    // The phone's status line reports steps and the finish instead.
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("kbd")).toBeNull();
  });

  it("carries the tools at a short window's row end, without key chips", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        short
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        stepCount={3}
        error={null}
        trailing={<button type="button">share</button>}
      />,
    );
    // The keys stay in each button's title and the shortcut list.
    expect(document.querySelector("kbd")).toBeNull();
    expect(screen.getByRole("button", { name: "assemble" }).getAttribute("title")).toBe("F6");
    expect(screen.getByRole("status").textContent).toBe("3 steps");
    const all = screen.getAllByRole("button").map((b) => b.textContent);
    expect(all[all.length - 1]).toBe("share");
  });

  it("keeps the key chips outside a short window", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    expect(document.querySelectorAll("kbd")).toHaveLength(5);
  });

  it("renders the five buttons as assemble, run, step, back, reset", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["assemble", "run", "step", "back", "reset"]);
  });

  it("disables back when canStepBack is false", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    const back = screen.getByRole("button", { name: /^back/ });
    expect(back.hasAttribute("disabled")).toBe(true);
  });

  it("calls onAssemble when assemble is clicked", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        error={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^assemble/ }));
    expect(h.onAssemble).toHaveBeenCalled();
  });

  it("toggles between run and pause based on isRunning", () => {
    const h = allHandlers();
    const { rerender } = render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    expect(screen.getByRole("button", { name: /^run/ })).toBeTruthy();
    rerender(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={true}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    expect(screen.getByRole("button", { name: /^pause/ })).toBeTruthy();
  });

  it("renders the halted indicator when isHalted and no error", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={true}
        programLoaded={true}
        error={null}
      />,
    );
    expect(screen.getByRole("status").textContent?.trim()).toMatch(/halted/);
  });

  it("shakes once per new error, and only on a new one", () => {
    // The alert is keyed by its message, so a new error remounts it and plays
    // the one-shot shake again, while the same error re-rendered does not.
    const h = allHandlers();
    const withError = (error: string) => (
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        error={error}
      />
    );
    const { rerender } = render(withError("boom"));
    const first = screen.getByRole("alert");
    expect(first.textContent).toContain("boom");
    expect(first.className).toContain("anim-error-shake");
    rerender(withError("boom"));
    expect(screen.getByRole("alert")).toBe(first);
    rerender(withError("bang"));
    const second = screen.getByRole("alert");
    expect(second).not.toBe(first);
    expect(second.className).toContain("anim-error-shake");
  });

  it("surfaces a plain-language recovery hint for a recognized error", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        error="unknown instruction 0x12345678: execution probably branched into data rather than code. Check the branch that got here, and the return address if this followed a ret"
      />,
    );
    const alert = screen.getByRole("alert");
    const text = alert.textContent?.toLowerCase() ?? "";
    expect(text).toContain("unknown instruction");
    expect(text).toContain("mnemonic");
  });

  it("disables run, step, and back until a program is loaded", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        error={null}
      />,
    );
    for (const name of [/^run/, /^step/, /^back/]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.hasAttribute("disabled")).toBe(true);
      fireEvent.click(btn);
    }
    expect(h.onRun).not.toHaveBeenCalled();
    expect(h.onStep).not.toHaveBeenCalled();
    expect(h.onStepBack).not.toHaveBeenCalled();
    // Assemble and reset stay live: they are how a program gets loaded.
    expect(
      screen.getByRole("button", { name: /^assemble/ }).hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: /^reset/ }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("enables run, step, and back once a program is loaded", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    for (const name of [/^run/, /^step/, /^back/]) {
      expect(
        screen.getByRole("button", { name }).hasAttribute("disabled"),
      ).toBe(false);
    }
    fireEvent.click(screen.getByRole("button", { name: /^step/ }));
    expect(h.onStep).toHaveBeenCalledTimes(1);
  });

  it("keeps run live with nothing loaded when run assembles first", () => {
    // Terminal mode: the run press is itself the launch, so the button cannot be
    // the one path that still demands a separate assemble press.
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        runAssemblesFirst={true}
        error={null}
      />,
    );
    const run = screen.getByRole("button", { name: /^run/ });
    expect(run.hasAttribute("disabled")).toBe(false);
    fireEvent.click(run);
    expect(h.onRun).toHaveBeenCalledTimes(1);
    // Step and back are untouched: they still have nothing to execute.
    for (const name of [/^step/, /^back/]) {
      expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(true);
    }
  });

  it("still disables run while that assemble is in flight", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isAssembling={true}
        isHalted={false}
        programLoaded={false}
        runAssemblesFirst={true}
        error={null}
      />,
    );
    const run = screen.getByRole("button", { name: /^run/ });
    expect(run.hasAttribute("disabled")).toBe(true);
    fireEvent.click(run);
    expect(h.onRun).not.toHaveBeenCalled();
  });

  it("still disables run while blocked, however run starts", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        runAssemblesFirst={true}
        blocked={true}
        error={null}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^run/ }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("does not bind keyboard shortcuts (the page is the single owner)", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error={null}
      />,
    );
    fireEvent.keyDown(window, { key: "F6" });
    fireEvent.keyDown(window, { key: "F10" });
    fireEvent.keyDown(window, { key: "F10", shiftKey: true });
    fireEvent.keyDown(window, { key: "F5" });
    fireEvent.keyDown(window, { key: "F5", shiftKey: true });
    expect(h.onAssemble).not.toHaveBeenCalled();
    expect(h.onStep).not.toHaveBeenCalled();
    expect(h.onStepBack).not.toHaveBeenCalled();
    expect(h.onRun).not.toHaveBeenCalled();
    expect(h.onPause).not.toHaveBeenCalled();
    expect(h.onReset).not.toHaveBeenCalled();
  });
});

describe("Controls while blocked on stdin", () => {
  const renderBlocked = () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        blocked={true}
        error={null}
      />,
    );
    return h;
  };

  it("disables run, step, and back", () => {
    renderBlocked();
    expect(screen.getByRole("button", { name: "run" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "step" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "back" })).toHaveProperty("disabled", true);
  });

  it("keeps assemble and reset live as the two exits", () => {
    const h = renderBlocked();
    const assemble = screen.getByRole("button", { name: "assemble" });
    const reset = screen.getByRole("button", { name: "reset" });
    expect(assemble).toHaveProperty("disabled", false);
    expect(reset).toHaveProperty("disabled", false);
    fireEvent.click(assemble);
    fireEvent.click(reset);
    expect(h.onAssemble).toHaveBeenCalledTimes(1);
    expect(h.onReset).toHaveBeenCalledTimes(1);
  });

  it("re-enables the stepping controls once input arrives", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        blocked={false}
        error={null}
      />,
    );
    expect(screen.getByRole("button", { name: "run" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "step" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "back" })).toHaveProperty("disabled", false);
  });
});
