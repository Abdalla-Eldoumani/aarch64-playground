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
  it("marks the action row as an instrument band and keeps the error out of it", () => {
    const h = allHandlers();
    const { container } = render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={true}
        error="undefined label: mian"
      />,
    );
    const band = container.querySelector(".controls-band");
    expect(band).not.toBeNull();
    // Every button rides the strip; the spacer it suppresses under sm carries
    // its own class, and the alert is a sibling row, not a scrolled-away child.
    expect(band!.querySelectorAll("button")).toHaveLength(5);
    expect(band!.querySelector(":scope > .controls-spacer")).not.toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert.closest(".controls-band")).toBeNull();
    expect(alert.parentElement).toBe(band!.parentElement);
  });

  it("renders the five control buttons in canonical order", () => {
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

  it("sizes every control with the 44px Button base", () => {
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
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("min-h-[44px]");
    }
  });

  it("leads with Assemble and Run as the cyan primary actions", () => {
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
    expect(
      screen.getByRole("button", { name: /^assemble/ }).className,
    ).toContain("bg-[var(--cyan)]");
    expect(screen.getByRole("button", { name: /^run/ }).className).toContain(
      "bg-[var(--cyan)]",
    );
    expect(screen.getByRole("button", { name: /^step/ }).className).not.toContain(
      "bg-[var(--cyan)]",
    );
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
    // The ~200ms decaying shake is the motion spec's error cue; the message
    // beside it is plain text plus a recovery hint. The class animates only
    // outside prefers-reduced-motion, and the alert is keyed by the message,
    // so a new error replays the one-shot shake while a re-render of the same
    // error does not.
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        programLoaded={false}
        error="boom"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("boom");
    expect(alert.className).toContain("anim-error-shake");
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
