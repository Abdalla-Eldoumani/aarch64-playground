import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReplayScrubber } from "@/components/playground/ReplayScrubber";
import type { ReplayFrame } from "@/lib/emulator/replay";

afterEach(() => cleanup());

function frame(stepCount: number): ReplayFrame {
  return {
    stepCount,
    registers: Array(31).fill("0x0"),
    sp: "0x0000000080000000",
    fpRegisters: [],
    pc: 0x400000 + stepCount * 4,
    nzcv: 0,
    changedRegs: [],
    changedFpRegs: [],
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

  it("releases a scrubbed position when the machine steps forward", () => {
    const onSeek = vi.fn();
    const frames = [frame(1), frame(2), frame(3)];
    const { rerender } = render(
      <ReplayScrubber frames={frames} currentStep={3} onSeek={onSeek} />,
    );
    const slider = screen.getByRole("slider", { name: /replay/i }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0" } });
    expect(slider.value).toBe("0");
    // A real Step arrives: new frame, higher live count. The handle and
    // label must track the live machine again, not the stale pin.
    const grown = [...frames, frame(4)];
    rerender(<ReplayScrubber frames={grown} currentStep={4} onSeek={onSeek} />);
    expect(slider.value).toBe("3");
    expect(screen.getByText(/step 4 \/ 4/)).toBeTruthy();
  });

  it("releases the pin when playback runs to the end", () => {
    vi.useFakeTimers();
    try {
      const onSeek = vi.fn();
      const frames = [frame(1), frame(2), frame(3)];
      render(<ReplayScrubber frames={frames} currentStep={3} onSeek={onSeek} />);
      fireEvent.click(screen.getByRole("button", { name: /play replay/i }));
      act(() => {
        vi.runAllTimers();
      });
      const slider = screen.getByRole("slider", { name: /replay/i }) as HTMLInputElement;
      // Playback finished: back on the live frame, not frozen at the
      // last played index.
      expect(slider.value).toBe("2");
    } finally {
      vi.useRealTimers();
    }
  });
});
