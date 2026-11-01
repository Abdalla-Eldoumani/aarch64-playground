import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FrameWalk } from "@/components/diagrams/FrameWalk";

afterEach(cleanup);

const next = () => fireEvent.click(screen.getByRole("button", { name: "next" }));
/** The stack band holding `text` (a title, an offset or a marker). */
const band = (text: string) =>
  within(screen.getByRole("list", { name: "stack bands" })).getByText(text).closest("li")!;

function currentLine(container: HTMLElement): string {
  return container.querySelector("[data-current]")?.textContent ?? "";
}

describe("FrameWalk", () => {
  it("starts at entry: frame closed, sp at the caller, back disabled", () => {
    render(<FrameWalk />);
    expect(screen.getByText("step 1 of 7")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "back" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByLabelText("sp: 0xffd0")).toBeTruthy();
    // Before the prologue the frame slots are only placeholders, with no
    // offset yet, and sp and fp both still point into the caller's frame.
    expect(screen.getByText("will hold the caller's lr")).toBeTruthy();
    expect(band("sp, fp").textContent).toContain("caller's frame");
    expect(band("saved lr").firstElementChild?.textContent).toBe("");
  });

  it("stp opens the frame: sp drops, the pair lands, sp marker moves to the base", () => {
    const { container } = render(<FrameWalk />);
    next();
    expect(screen.getByText("step 2 of 7")).toBeTruthy();
    expect(currentLine(container)).toContain("stp");
    expect(
      screen.getByLabelText("sp: 0xffb0, changed this step"),
    ).toBeTruthy();
    expect(screen.getByText("caller's lr, at [fp, 8]")).toBeTruthy();
    expect(band("sp").textContent).toContain("saved fp");
    expect(band("fp").textContent).toContain("caller's frame");
    // fp is not set yet, so the offsets count from sp, as the frames view's do.
    expect(band("sp + 8").textContent).toContain("saved lr");
    expect(band("sp + 16").textContent).toContain("locals");
    // stp wrote the pair: both boxes carry the amber bar.
    for (const title of ["saved fp", "saved lr"]) {
      expect(screen.getByText(title).parentElement?.style.boxShadow).toContain("var(--amber)");
    }
  });

  it("keeps a band's bracketed operand whole with non-breaking spaces", () => {
    render(<FrameWalk />);
    // Past the stp, so the pair's detail carries no ", just written" note.
    next();
    next();
    expect(screen.getByText("caller's lr, at [fp, 8]").textContent).toBe(
      "caller's lr, at [fp, 8]",
    );
  });

  it("mov fp, sp anchors the frame pointer at the saved pair", () => {
    render(<FrameWalk />);
    next();
    next();
    expect(
      screen.getByLabelText("fp: 0xffb0, changed this step"),
    ).toBeTruthy();
    expect(band("sp, fp").textContent).toContain("saved fp");
    expect(band("fp + 8").textContent).toContain("saved lr");
    expect(band("fp + 16").textContent).toContain("locals");
  });

  it("the local store lands above the pair at a positive offset", () => {
    render(<FrameWalk />);
    next();
    next();
    next();
    expect(screen.getByText("w9 -> 7 at [fp, 16]")).toBeTruthy();
  });

  it("bl rewrites lr, the reason the prologue saved it", () => {
    render(<FrameWalk />);
    for (let i = 0; i < 4; i++) next();
    expect(
      screen.getByLabelText("lr: after the bl, changed this step"),
    ).toBeTruthy();
  });

  it("ldp closes the frame and the walk ends with next disabled", () => {
    const { container } = render(<FrameWalk />);
    for (let i = 0; i < 5; i++) next();
    expect(screen.getByLabelText(/sp: 0xffd0/)).toBeTruthy();
    expect(screen.getByText("will hold the caller's lr")).toBeTruthy();
    next();
    expect(currentLine(container)).toContain("ret");
    expect(
      (screen.getByRole("button", { name: "next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("arrow keys drive the walk from the controls group", () => {
    render(<FrameWalk />);
    const group = screen.getByRole("group", { name: "frame walk steps" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(screen.getByText("step 2 of 7")).toBeTruthy();
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(screen.getByText("step 1 of 7")).toBeTruthy();
  });
});
