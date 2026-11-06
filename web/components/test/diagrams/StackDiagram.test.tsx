// Pins the still stack picture: frames drawn high to low as labelled lists of
// bands, in the frames view's rows: the offset on the left, its box colours,
// and where sp and fp point on the right.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { StackDiagram } from "@/components/diagrams/StackDiagram";

afterEach(cleanup);

const FRAMES = [
  {
    title: "caller's frame",
    bands: [{ label: "caller's frame record", detail: "saved fp and lr", offset: "fp + 0", kind: "saved" as const }],
  },
  {
    title: "callee's frame",
    bands: [
      { label: "saved x19", detail: "[fp, 16]", offset: "fp + 16", kind: "local" as const },
      { label: "argument", detail: "[sp]", kind: "local" as const, marker: "sp" },
      { label: "unused", detail: "padding", ghost: true },
    ],
  },
];

/** The box a band's title sits in. */
const box = (title: string) => screen.getByText(title).parentElement!;

describe("StackDiagram", () => {
  it("names itself and draws each frame as its own list, in the order given", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    const diagram = screen.getByLabelText("a test stack");
    const lists = within(diagram).getAllByRole("list");
    expect(lists.map((list) => list.getAttribute("aria-label"))).toEqual(["caller's frame", "callee's frame"]);
    // The bracketed operand keeps a no-break space; the marker reads "sp points here".
    expect(
      within(lists[1])
        .getAllByRole("listitem")
        .map((li) => li.textContent?.replace(/ /g, " ")),
    ).toEqual(["fp + 16saved x19[fp, 16]", "argument[sp]← sp points here", "unusedpadding"]);
  });

  it("keeps the offset column on a band with no offset, so the boxes line up", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    const row = screen.getByText("argument").closest("li")!;
    expect(row.children).toHaveLength(3);
    expect(row.firstElementChild?.textContent).toBe("");
  });

  it("draws the saved record, the named slots and the padding in the frames view's colours", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    expect(box("caller's frame record").className).toContain("text-[var(--syntax-number)]");
    expect(box("saved x19").className).toContain("text-[var(--success)]");
    expect(box("unused").className).toContain("border-dashed");
    expect(within(screen.getByText("argument").closest("li")!).getByText("sp")).toBeTruthy();
  });

  it("marks which end of the stack is high", () => {
    render(<StackDiagram label="a test stack" frames={FRAMES} />);
    expect(screen.getByText("high addresses")).toBeTruthy();
    expect(screen.getByText("low addresses")).toBeTruthy();
  });
});
