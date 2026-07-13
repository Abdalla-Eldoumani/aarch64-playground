// pins the die floorplan motif: a decorative block diagram naming the
// functional units, the pc marker riding the fetch/decode strip, and
// the exec block inked amber as the active stage.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DieFloorplan } from "@/components/landing/DieFloorplan";

afterEach(() => cleanup());

describe("DieFloorplan", () => {
  it("is decorative: the whole floorplan is aria-hidden", () => {
    const { container } = render(<DieFloorplan />);
    expect((container.firstChild as HTMLElement).getAttribute("aria-hidden")).toBe("true");
  });

  it("labels every functional unit", () => {
    render(<DieFloorplan />);
    expect(screen.getByText("fetch / decode")).toBeTruthy();
    expect(screen.getByText("exec")).toBeTruthy();
    expect(screen.getByText("regfile")).toBeTruthy();
    expect(screen.getByText("mem")).toBeTruthy();
    expect(screen.getByText("i/o")).toBeTruthy();
  });

  it("rides the pc marker inside the fetch/decode strip", () => {
    render(<DieFloorplan />);
    const pc = screen.getByText(/pc/);
    expect(pc.closest("span")?.parentElement?.textContent).toContain("fetch / decode");
    expect(pc.className).toContain("text-[var(--amber)]");
  });

  it("lights only the exec block amber", () => {
    render(<DieFloorplan />);
    const exec = screen.getByText("exec");
    expect(exec.className).toContain("border-[var(--amber)]");
    expect(exec.className).toContain("text-[var(--amber)]");
    expect(screen.getByText("regfile").className).not.toContain("border-[var(--amber)]");
  });

  it("passes className through to the floorplan wrapper", () => {
    const { container } = render(<DieFloorplan className="hidden lg:grid" />);
    expect((container.firstChild as HTMLElement).className).toContain("hidden lg:grid");
  });
});
