import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LectureBar } from "./LectureBar";

afterEach(() => cleanup());

describe("LectureBar", () => {
  it("renders a step and reset button", () => {
    render(<LectureBar onStep={vi.fn()} onReset={vi.fn()} stepCount={0} isHalted={false} programLoaded={true} />);
    expect(screen.getByRole("button", { name: /step/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /reset/i })).toBeTruthy();
  });

  it("invokes onStep when the step button is clicked", () => {
    const onStep = vi.fn();
    render(<LectureBar onStep={onStep} onReset={vi.fn()} stepCount={0} isHalted={false} programLoaded={true} />);
    fireEvent.click(screen.getByRole("button", { name: /step/i }));
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it("re-applies the step-pop animation when stepCount changes", () => {
    const { rerender } = render(<LectureBar onStep={vi.fn()} onReset={vi.fn()} stepCount={0} isHalted={false} programLoaded={true} />);
    const before = screen.getByRole("button", { name: /step/i });
    rerender(<LectureBar onStep={vi.fn()} onReset={vi.fn()} stepCount={1} isHalted={false} programLoaded={true} />);
    const after = screen.getByRole("button", { name: /step/i });
    // React keys force a remount, so the DOM node identity changes.
    expect(before).not.toBe(after);
  });

  it("disables the step button when halted", () => {
    render(<LectureBar onStep={vi.fn()} onReset={vi.fn()} stepCount={0} isHalted={true} programLoaded={true} />);
    expect((screen.getByRole("button", { name: /step/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the step button when no program is loaded", () => {
    const onStep = vi.fn();
    render(<LectureBar onStep={onStep} onReset={vi.fn()} stepCount={0} isHalted={false} programLoaded={false} />);
    const step = screen.getByRole("button", { name: /step/i }) as HTMLButtonElement;
    expect(step.disabled).toBe(true);
    fireEvent.click(step);
    expect(onStep).not.toHaveBeenCalled();
  });
});
