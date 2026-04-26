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
    // Button text includes a kbd chip child (e.g. "assembleF6"); pull
    // just the leading mnemonic from the first child span.
    const labels = screen.getAllByRole("button").map((b) => {
      const span = b.querySelector("span");
      return span?.textContent?.trim();
    });
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

  it("renders the error message and applies the shake animation class", () => {
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
    expect(alert.textContent).toBe("boom");
    expect(alert.className).toContain("anim-error-shake");
  });

  it("F6 fires onAssemble globally", () => {
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
    fireEvent.keyDown(window, { key: "F6" });
    expect(h.onAssemble).toHaveBeenCalled();
  });
});
