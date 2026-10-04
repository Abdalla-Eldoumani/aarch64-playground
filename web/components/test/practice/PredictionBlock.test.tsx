import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PredictionBlock } from "@/components/practice/PredictionBlock";

afterEach(() => cleanup());

const PROPS = {
  code: "mov x20, 0x1000\nldr x21, [x20, 16]!",
  question: "What is in x20 afterward?",
  answer: "0x1010",
  explanation: "Pre-indexing updates the base register before the load.",
  hint: "16 in decimal is 0x10 in hex.",
};

describe("PredictionBlock", () => {
  it("renders the snippet and a labeled input, with checking disabled while empty", () => {
    render(<PredictionBlock {...PROPS} />);
    expect(screen.getByText(/mov x20, 0x1000/)).toBeTruthy();
    const check = screen.getByRole("button", { name: "check answer" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(screen.getByLabelText(PROPS.question)).toBeTruthy();
  });

  it("ignores surrounding spaces and letter case when grading", () => {
    const onAttempt = vi.fn();
    render(<PredictionBlock {...PROPS} onAttempt={onAttempt} />);
    fireEvent.change(screen.getByLabelText(PROPS.question), { target: { value: " 0X1010 " } });
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(onAttempt).toHaveBeenCalledWith(true);
    expect(screen.getByText(PROPS.explanation)).toBeTruthy();
  });

  it("shows only the hint on a wrong prediction and resets through try again", () => {
    const onAttempt = vi.fn();
    render(<PredictionBlock {...PROPS} onAttempt={onAttempt} />);
    const input = screen.getByLabelText(PROPS.question) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0x1000" } });
    fireEvent.click(screen.getByRole("button", { name: "check answer" }));
    expect(onAttempt).toHaveBeenCalledWith(false);
    expect(screen.getByText(PROPS.hint)).toBeTruthy();
    expect(screen.queryByText(PROPS.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "try again" }));
    expect(input.value).toBe("");
  });
});

describe("PredictionBlock controlled answer", () => {
  it("renders the answer the sheet passes in", () => {
    render(<PredictionBlock {...PROPS} value="0x1010" onValueChange={() => {}} />);
    expect((screen.getByLabelText(PROPS.question) as HTMLInputElement).value).toBe("0x1010");
  });

  it("reports every keystroke", () => {
    const onValueChange = vi.fn();
    render(<PredictionBlock {...PROPS} value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByLabelText(PROPS.question), { target: { value: "0x10" } });
    expect(onValueChange).toHaveBeenCalledWith("0x10");
  });

  // The answer box's own outline is off, so the ring is its only focus mark.
  it("rings the answer box on keyboard focus", () => {
    render(<PredictionBlock {...PROPS} />);
    expect(screen.getByLabelText(PROPS.question).className).toContain("focus-visible:[box-shadow:var(--ring)]");
  });

  // A phone shows no scrollbar until a swipe, so a snippet line cut at the
  // right edge needs a cue.
  it("fades the snippet's right edge only while a line runs past it", () => {
    const widths = (scroll: number, client: number) => {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => scroll });
      Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => client });
    };
    const fade = (root: HTMLElement) =>
      root.querySelector("pre")?.parentElement?.querySelector('[aria-hidden="true"].bg-gradient-to-l');
    try {
      widths(600, 300);
      const wide = render(<PredictionBlock {...PROPS} />);
      expect(fade(wide.container)).toBeTruthy();
      wide.unmount();
      widths(300, 300);
      const fits = render(<PredictionBlock {...PROPS} />);
      expect(fade(fits.container)).toBeNull();
    } finally {
      // The prototype getters are jsdom's zeros; drop the overrides.
      delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });

  it("still owns its answer when no value is passed", () => {
    render(<PredictionBlock {...PROPS} />);
    const input = screen.getByLabelText(PROPS.question) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0x1010" } });
    expect(input.value).toBe("0x1010");
  });
});
