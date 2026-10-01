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
      const instruction = currentLine(container).split("//")[0].trim();
      expect(instruction.length, spell).toBeGreaterThan(0);
      expect(squeeze(spell).includes(instruction), `${spell} names ${instruction}`).toBe(true);
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

  // jsdom keeps focus on a button that turns disabled, but a browser drops it
  // to the page, so the test also asks that the focused button is enabled.
  it("keeps focus on an enabled step control at both ends of the walk", () => {
    render(<FactorialWalk />);
    const group = screen.getByRole("group", { name: "factorial walk steps" });
    const focused = () => document.activeElement as HTMLButtonElement;

    screen.getByRole("button", { name: "next" }).focus();
    for (let i = 0; i < 8; i++) fireEvent.keyDown(focused(), { key: "ArrowRight" });
    expect(screen.getByText("step 9 of 9")).toBeTruthy();
    expect(group.contains(focused())).toBe(true);
    expect(focused().textContent).toBe("back");
    expect(focused().disabled).toBe(false);
    fireEvent.keyDown(focused(), { key: "ArrowLeft" });
    expect(screen.getByText("step 8 of 9")).toBeTruthy();

    for (let i = 0; i < 7; i++) fireEvent.click(focused());
    expect(screen.getByText("step 1 of 9")).toBeTruthy();
    expect(group.contains(focused())).toBe(true);
    expect(focused().textContent).toBe("next");
    expect(focused().disabled).toBe(false);
    fireEvent.keyDown(focused(), { key: "ArrowRight" });
    expect(screen.getByText("step 2 of 9")).toBeTruthy();
  });
});
