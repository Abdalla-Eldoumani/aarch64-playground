import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReplayScrubber } from "./ReplayScrubber";
import type { ReplayFrame } from "@/lib/replay";

afterEach(() => cleanup());

function frame(stepCount: number): ReplayFrame {
  return {
    stepCount,
    registers: Array(31).fill("0x0"),
    pc: 0x400000 + stepCount * 4,
    nzcv: 0,
    changedRegs: [],
    currentLine: stepCount,
  };
}

describe("ReplayScrubber", () => {
  it("renders nothing when fewer than two frames", () => {
    const { container } = render(
      <ReplayScrubber frames={[]} currentStep={0} onSeek={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing with a single frame", () => {
    const { container } = render(
      <ReplayScrubber frames={[frame(1)]} currentStep={1} onSeek={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a slider when there are >= 2 frames", () => {
    render(
      <ReplayScrubber
        frames={[frame(1), frame(2), frame(3)]}
        currentStep={3}
        onSeek={vi.fn()}
      />,
    );
    const slider = screen.getByRole("slider", { name: /replay/i });
    expect(slider).toBeTruthy();
    expect((slider as HTMLInputElement).max).toBe("2");
  });

  it("invokes onSeek with the new frame index when the slider moves", () => {
    const onSeek = vi.fn();
    render(
      <ReplayScrubber
        frames={[frame(1), frame(2), frame(3)]}
        currentStep={3}
        onSeek={onSeek}
      />,
    );
    const slider = screen.getByRole("slider", { name: /replay/i }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0" } });
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
