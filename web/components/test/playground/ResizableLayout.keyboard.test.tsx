// The one suite that runs against the REAL react-resizable-panels: the grip
// exists so it can be operated without a mouse, and only the library itself
// can prove the arrow keys reach a focused separator. jsdom measures nothing,
// so the group's panels are given a size and the ResizeObserver the library
// constructs is stubbed; everything else is the shipped component.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ResizableLayout } from "@/components/playground/ResizableLayout";

const KEY = "aarch64-playground:layout:";
const PANEL_PX = 500;

const originals = {
  resizeObserver: globalThis.ResizeObserver,
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
};

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver =
    StubResizeObserver as unknown as typeof globalThis.ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => PANEL_PX,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => PANEL_PX,
  });
});

afterAll(() => {
  globalThis.ResizeObserver = originals.resizeObserver;
  if (originals.offsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originals.offsetWidth);
  }
  if (originals.offsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originals.offsetHeight);
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderLayout() {
  return render(
    <ResizableLayout
      breakpoint="lg"
      editor={<span>EDITOR</span>}
      disassembly={<span>DISASM</span>}
      registers={<span>REGS</span>}
      rightTabs={<span>TABS</span>}
    />,
  );
}

describe("ResizableLayout keyboard resizing", () => {
  it("puts every grip in the tab order with a resize position on it", () => {
    renderLayout();
    const seams = screen.getAllByRole("separator");
    expect(seams.length).toBe(3);
    for (const seam of seams) {
      expect(seam.getAttribute("tabindex")).toBe("0");
      expect(seam.getAttribute("aria-label")).toBeTruthy();
    }
    expect(
      screen.getByLabelText("resize editor and debug column").getAttribute("aria-valuenow"),
    ).toBe("55");
  });

  it("moves the split when an arrow key reaches the focused grip", () => {
    renderLayout();
    const seam = screen.getByLabelText("resize editor and debug column");
    seam.focus();
    expect(document.activeElement).toBe(seam);

    fireEvent.keyDown(seam, { key: "ArrowRight" });
    expect(seam.getAttribute("aria-valuenow")).toBe("60");

    fireEvent.keyDown(seam, { key: "ArrowLeft" });
    fireEvent.keyDown(seam, { key: "ArrowLeft" });
    expect(seam.getAttribute("aria-valuenow")).toBe("50");
  });

  it("resizes the vertical pairs on the up and down arrows", () => {
    renderLayout();
    const seam = screen.getByLabelText("resize registers and tabs");
    seam.focus();

    fireEvent.keyDown(seam, { key: "ArrowDown" });
    expect(seam.getAttribute("aria-valuenow")).toBe("50");
  });

  it("writes a keyboard resize through to storage like a drag", () => {
    renderLayout();
    const seam = screen.getByLabelText("resize editor and debug column");
    seam.focus();
    fireEvent.keyDown(seam, { key: "ArrowRight" });
    expect(window.localStorage.getItem(`${KEY}lg`)).toBe("[60,40]");
  });
});
