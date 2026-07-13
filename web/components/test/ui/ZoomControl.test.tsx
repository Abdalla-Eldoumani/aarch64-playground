// pins the zoom control contract: minus/percent/plus wired to the three
// callbacks, the middle button both showing the rounded percentage and
// announcing it in its reset label.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZoomControl } from "@/components/ui/ZoomControl";

afterEach(() => cleanup());

function renderControl(scale = 1) {
  const onZoomIn = vi.fn();
  const onZoomOut = vi.fn();
  const onReset = vi.fn();
  render(
    <ZoomControl
      scale={scale}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onReset={onReset}
    />,
  );
  return { onZoomIn, onZoomOut, onReset };
}

describe("ZoomControl", () => {
  it("renders a labelled group with zoom out, reset, and zoom in buttons", () => {
    renderControl();
    const group = screen.getByRole("group", { name: "zoom" });
    expect(group.querySelectorAll("button").length).toBe(3);
    expect(screen.getByRole("button", { name: "zoom out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "zoom in" })).toBeTruthy();
  });

  it("shows 100% at scale 1 and announces it in the reset label", () => {
    renderControl(1);
    const reset = screen.getByRole("button", {
      name: "reset zoom (currently 100 percent)",
    });
    expect(reset.textContent).toBe("100%");
  });

  it("rounds the displayed percentage", () => {
    renderControl(0.6666);
    expect(
      screen.getByRole("button", { name: "reset zoom (currently 67 percent)" })
        .textContent,
    ).toBe("67%");
  });

  it("fires exactly the matching callback per button", () => {
    const { onZoomIn, onZoomOut, onReset } = renderControl(1.3);
    fireEvent.click(screen.getByRole("button", { name: "zoom in" }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "zoom out" }));
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "reset zoom (currently 130 percent)" }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });
});
