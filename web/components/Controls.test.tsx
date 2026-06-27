import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Controls } from "./Controls";

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
  it("renders the five control buttons in canonical order", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
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
        error={null}
      />,
    );
    expect(screen.getByRole("status").textContent?.trim()).toMatch(/halted/);
  });

  it("renders the error calmly, without the shake animation", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        error="boom"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("boom");
    expect(alert.className).not.toContain("anim-error-shake");
    expect(alert.innerHTML).not.toContain("anim-error-shake");
  });

  it("surfaces a plain-language recovery hint for a recognized error", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={false}
        isRunning={false}
        isHalted={false}
        error="unknown instruction: 0x12345678"
      />,
    );
    const alert = screen.getByRole("alert");
    const text = alert.textContent?.toLowerCase() ?? "";
    expect(text).toContain("unknown instruction");
    expect(text).toContain("mnemonic");
  });

  it("does not bind keyboard shortcuts (the page is the single owner)", () => {
    const h = allHandlers();
    render(
      <Controls
        {...h}
        canStepBack={true}
        isRunning={false}
        isHalted={false}
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
