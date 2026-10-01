// Pins the one-register diagram: the five scalar names with the bits each
// reads, and the four 128-bit arrangements with their lane counts, lane 0 at
// the right (low) end.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VectorRegisterViews } from "@/components/diagrams/VectorRegisterViews";

afterEach(cleanup);

function row(name: string): HTMLElement {
  const li = screen.getByText(name).closest("li");
  expect(li, name).not.toBeNull();
  return li as HTMLElement;
}

/** The byte columns each bar segment spans, left (high bits) to right. */
function spans(li: HTMLElement): number[] {
  const bar = li.querySelector('[aria-hidden="true"]') as HTMLElement;
  return [...bar.children].map((cell) => Number((cell as HTMLElement).style.gridColumn.match(/span (\d+)/)?.[1]));
}

describe("VectorRegisterViews", () => {
  it("exposes an accessible name", () => {
    render(<VectorRegisterViews />);
    expect(screen.getByLabelText("one vector register, every name")).toBeTruthy();
  });

  it("draws each scalar name over the low bytes it reads", () => {
    render(<VectorRegisterViews />);
    expect(spans(row("q0"))).toEqual([16]);
    expect(spans(row("d0"))).toEqual([8, 8]);
    expect(spans(row("s0"))).toEqual([12, 4]);
    expect(spans(row("h0"))).toEqual([14, 2]);
    expect(spans(row("b0"))).toEqual([15, 1]);
    expect(row("d0").textContent).toContain("bits 63:0");
  });

  it("splits the same 16 bytes into 2, 4, 8 and 16 lanes, numbered down to lane 0 at the right", () => {
    render(<VectorRegisterViews />);
    expect(spans(row("v0.2d"))).toEqual([8, 8]);
    expect(spans(row("v0.4s"))).toEqual([4, 4, 4, 4]);
    expect(spans(row("v0.8h"))).toEqual(Array(8).fill(2));
    expect(spans(row("v0.16b"))).toEqual(Array(16).fill(1));
    const lanes = row("v0.4s").querySelector('[aria-hidden="true"]')!.textContent;
    expect(lanes).toBe("3210");
  });
});
