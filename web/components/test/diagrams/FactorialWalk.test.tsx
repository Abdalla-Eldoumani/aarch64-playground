// Pins the recursion walk: nine steps over the factorial example's own fact
// routine, each highlighting the instruction it names, four frames open at
// the deepest point, and 24 in x0 back in main.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FactorialWalk } from "@/components/diagrams/FactorialWalk";

afterEach(cleanup);

const next = () => fireEvent.click(screen.getByRole("button", { name: "next" }));
const squeeze = (text: string) => text.trim().replace(/\s+/g, " ");

function currentLine(container: HTMLElement): string {
  return squeeze(container.querySelector("[data-current]")?.textContent ?? "");
}

function openFrames(): string[] {
  const bands = screen.getByRole("list", { name: "stack bands" });
  return within(bands)
    .getAllByRole("listitem")
    .filter((li) => !li.className.includes("border-dashed"))
    .map((li) => li.textContent?.match(/^(main|fact\(\d\))'s frame/)?.[1] ?? "");
}

describe("FactorialWalk", () => {
  it("highlights, on every step, the instruction its header names", () => {
    const { container } = render(<FactorialWalk />);
    expect(screen.getByText("step 1 of 9")).toBeTruthy();
    for (let step = 0; step < 9; step++) {
      const spell = screen.getByLabelText("factorial walk").querySelector("header p:last-child")!.textContent!;
      const instruction = spell.slice(spell.indexOf(": ") + 2);
      expect(currentLine(container).startsWith(squeeze(instruction)), spell).toBe(true);
      if (step < 8) next();
    }
  });

  it("opens one frame per call, four deep at fact(1)", () => {
    render(<FactorialWalk />);
    expect(openFrames()).toEqual(["main"]);
    for (let i = 0; i < 4; i++) next();
    expect(screen.getByText("fact(1): b.le fact_done")).toBeTruthy();
    expect(openFrames()).toEqual(["main", "fact(4)", "fact(3)", "fact(2)", "fact(1)"]);
    expect(screen.getByLabelText("x19: 1, changed this step")).toBeTruthy();
  });

  it("closes them in reverse order and returns 24 to main", () => {
    render(<FactorialWalk />);
    for (let i = 0; i < 5; i++) next();
    expect(openFrames()).toEqual(["main", "fact(4)", "fact(3)", "fact(2)"]);
    expect(screen.getByLabelText("x0: 2, changed this step")).toBeTruthy();
    for (let i = 0; i < 3; i++) next();
    expect(openFrames()).toEqual(["main"]);
    expect(screen.getByLabelText("x0: 24")).toBeTruthy();
    expect(screen.getByLabelText("x19: main's, changed this step")).toBeTruthy();
    expect((screen.getByRole("button", { name: "next" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("names its step controls after the walk", () => {
    render(<FactorialWalk />);
    expect(screen.getByRole("group", { name: "factorial walk steps" })).toBeTruthy();
  });
});
