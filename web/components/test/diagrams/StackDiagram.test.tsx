// Pins the still stack picture: frames drawn high to low as labelled lists of
// bands, with the role tints and pointer chips the frame walk uses.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { StackDiagram } from "@/components/diagrams/StackDiagram";

afterEach(cleanup);

const FRAMES = [
  { title: "caller's frame", bands: [{ label: "caller's frame record", detail: "saved fp and lr" }] },
  {
    title: "callee's frame",
    bands: [
      { label: "saved x19", detail: "[fp, 16]", tint: "amber" as const },
      { label: "argument", detail: "[sp]", tint: "cyan" as const, markers: ["<- sp"] },
      { label: "unused", detail: "padding", ghost: true },
    ],
  },
];

describe("StackDiagram", () => {
  it("names itself and draws each frame as its own list, in the order given", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    const diagram = screen.getByLabelText("a test stack");
    const lists = within(diagram).getAllByRole("list");
    expect(lists.map((list) => list.getAttribute("aria-label"))).toEqual(["caller's frame", "callee's frame"]);
    expect(within(lists[1]).getAllByRole("listitem").map((li) => li.textContent?.split("[")[0])).toEqual([
      "saved x19",
      "argument",
      "unusedpadding",
    ]);
  });

  it("tints saved bands amber and passed bands cyan, and keeps the pointer chip", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    const saved = screen.getByText("saved x19").closest("li")!;
    const passed = screen.getByText("argument").closest("li")!;
    expect(saved.getAttribute("style")).toContain("var(--amber)");
    expect(passed.getAttribute("style")).toContain("var(--cyan)");
    expect(within(passed).getByText("<- sp")).toBeTruthy();
    expect(screen.getByText("unused").closest("li")!.className).toContain("border-dashed");
  });

  it("marks which end of the stack is high", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    expect(screen.getByText("high addresses")).toBeTruthy();
    expect(screen.getByText("low addresses")).toBeTruthy();
  });
});
