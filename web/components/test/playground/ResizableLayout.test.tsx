// pins what the laptop layout itself owns, with the panel library mocked
// away: the four-pane arrangement (an outer horizontal split, a vertical
// split inside each column), which slot each child lands in, the three
// localStorage keys the breakpoint prop derives, and the size mapping in
// both directions: a persisted array becomes the panes' default sizes, and
// a finished drag is written back by panel id, with a missing id keeping the
// size it already had rather than collapsing the pane to zero.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";

type Layout = Record<string, number>;

// The real Group hands onLayoutChange to a drag gesture behind a
// ResizeObserver jsdom does not have. The mock parks the callback on the
// group's own DOM node, so a test can fire it exactly as a finished drag
// would without a synthetic pointer.
const dragHandlers = vi.hoisted(() => new WeakMap<Element, (l: Layout) => void>());

vi.mock("react-resizable-panels", () => ({
  Group: ({
    orientation,
    defaultLayout,
    onLayoutChange,
    children,
  }: {
    orientation: string;
    defaultLayout: Layout;
    onLayoutChange: (l: Layout) => void;
    children: ReactNode;
  }) => (
    <div
      data-group={orientation}
      data-layout={JSON.stringify(defaultLayout)}
      ref={(el) => {
        if (el) dragHandlers.set(el, onLayoutChange);
      }}
    >
      {children}
    </div>
  ),
  Panel: ({
    id,
    minSize,
    defaultSize,
    children,
  }: {
    id: string;
    minSize: string;
    defaultSize: string;
    children?: ReactNode;
  }) => (
    <div data-panel={id} data-min={minSize} data-size={defaultSize}>
      {children}
    </div>
  ),
  Separator: () => <div data-separator="" />,
}));

import { ResizableLayout } from "@/components/playground/ResizableLayout";

const KEY = "aarch64-playground:layout:";

function renderLayout(breakpoint: "lg" | "xl" = "lg") {
  return render(
    <ResizableLayout
      breakpoint={breakpoint}
      editor={<span>EDITOR</span>}
      disassembly={<span>DISASM</span>}
      registers={<span>REGS</span>}
      rightTabs={<span>TABS</span>}
    />,
  );
}

function panel(id: string): HTMLElement {
  const el = document.querySelector(`[data-panel="${id}"]`);
  if (!el) throw new Error(`no pane ${id}`);
  return el as HTMLElement;
}

/** The group that owns a given pane id, found by the layout it declares. */
function group(paneId: string): HTMLElement {
  const el = document.querySelector(`[data-layout*="${paneId}"]`);
  if (!el) throw new Error(`no group holding ${paneId}`);
  return el as HTMLElement;
}

function drag(paneId: string, layout: Layout): void {
  const handler = dragHandlers.get(group(paneId));
  if (!handler) throw new Error(`no drag handler for ${paneId}`);
  act(() => handler(layout));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ResizableLayout", () => {
  it("splits the screen into two columns, each a vertical pair", () => {
    renderLayout();
    const outer = group("panel-left");
    expect(outer.getAttribute("data-group")).toBe("horizontal");

    const columns = Array.from(outer.children).filter((c) =>
      c.hasAttribute("data-panel"),
    );
    expect(columns.map((c) => c.getAttribute("data-panel"))).toEqual([
      "panel-left",
      "panel-right",
    ]);

    const left = panel("panel-left").querySelector("[data-group]") as HTMLElement;
    const right = panel("panel-right").querySelector("[data-group]") as HTMLElement;
    expect(left.getAttribute("data-group")).toBe("vertical");
    expect(right.getAttribute("data-group")).toBe("vertical");
    expect(
      Array.from(left.children)
        .filter((c) => c.hasAttribute("data-panel"))
        .map((c) => c.getAttribute("data-panel")),
    ).toEqual(["panel-editor", "panel-disasm"]);
    expect(
      Array.from(right.children)
        .filter((c) => c.hasAttribute("data-panel"))
        .map((c) => c.getAttribute("data-panel")),
    ).toEqual(["panel-regs", "panel-tabs"]);
  });

  it("gives every group a handle to drag", () => {
    renderLayout();
    expect(document.querySelectorAll("[data-separator]").length).toBe(3);
  });

  it("puts each child in its own pane", () => {
    renderLayout();
    expect(panel("panel-editor").textContent).toBe("EDITOR");
    expect(panel("panel-disasm").textContent).toBe("DISASM");
    expect(panel("panel-regs").textContent).toBe("REGS");
    expect(panel("panel-tabs").textContent).toBe("TABS");
  });

  it("opens on the authored defaults when nothing is stored", () => {
    renderLayout();
    expect(panel("panel-left").getAttribute("data-size")).toBe("55%");
    expect(panel("panel-right").getAttribute("data-size")).toBe("45%");
    expect(panel("panel-editor").getAttribute("data-size")).toBe("70%");
    expect(panel("panel-disasm").getAttribute("data-size")).toBe("30%");
    expect(panel("panel-regs").getAttribute("data-size")).toBe("45%");
    expect(panel("panel-tabs").getAttribute("data-size")).toBe("55%");
  });

  it("keeps a pane from being dragged shut", () => {
    renderLayout();
    expect(panel("panel-left").getAttribute("data-min")).toBe("25%");
    expect(panel("panel-right").getAttribute("data-min")).toBe("25%");
    expect(panel("panel-editor").getAttribute("data-min")).toBe("20%");
    expect(panel("panel-disasm").getAttribute("data-min")).toBe("15%");
    expect(panel("panel-regs").getAttribute("data-min")).toBe("20%");
    expect(panel("panel-tabs").getAttribute("data-min")).toBe("20%");
  });

  it("restores the three stored splits, one key per group", () => {
    window.localStorage.setItem(`${KEY}lg`, "[30,70]");
    window.localStorage.setItem(`${KEY}lg-left`, "[80,20]");
    window.localStorage.setItem(`${KEY}lg-right`, "[25,75]");
    renderLayout();
    expect(panel("panel-left").getAttribute("data-size")).toBe("30%");
    expect(panel("panel-right").getAttribute("data-size")).toBe("70%");
    expect(panel("panel-editor").getAttribute("data-size")).toBe("80%");
    expect(panel("panel-disasm").getAttribute("data-size")).toBe("20%");
    expect(panel("panel-regs").getAttribute("data-size")).toBe("25%");
    expect(panel("panel-tabs").getAttribute("data-size")).toBe("75%");
  });

  it("names each group's layout by panel id", () => {
    renderLayout();
    expect(JSON.parse(group("panel-left").getAttribute("data-layout") ?? "{}")).toEqual({
      "panel-left": 55,
      "panel-right": 45,
    });
    expect(JSON.parse(group("panel-editor").getAttribute("data-layout") ?? "{}")).toEqual({
      "panel-editor": 70,
      "panel-disasm": 30,
    });
    expect(JSON.parse(group("panel-regs").getAttribute("data-layout") ?? "{}")).toEqual({
      "panel-regs": 45,
      "panel-tabs": 55,
    });
  });

  it("writes a finished drag back under the group's own key", () => {
    renderLayout();
    drag("panel-left", { "panel-left": 40, "panel-right": 60 });
    drag("panel-editor", { "panel-editor": 65, "panel-disasm": 35 });
    drag("panel-regs", { "panel-regs": 50, "panel-tabs": 50 });
    expect(window.localStorage.getItem(`${KEY}lg`)).toBe("[40,60]");
    expect(window.localStorage.getItem(`${KEY}lg-left`)).toBe("[65,35]");
    expect(window.localStorage.getItem(`${KEY}lg-right`)).toBe("[50,50]");
  });

  it("keeps a pane's current size when the reported layout omits it", () => {
    renderLayout();
    // A layout the library reports without one of the ids must not read as
    // "that pane is now zero".
    drag("panel-left", { "panel-left": 33 });
    expect(window.localStorage.getItem(`${KEY}lg`)).toBe("[33,45]");
  });

  it("stores a different breakpoint's splits under its own three keys", () => {
    renderLayout("xl");
    drag("panel-left", { "panel-left": 60, "panel-right": 40 });
    drag("panel-regs", { "panel-regs": 35, "panel-tabs": 65 });
    expect(window.localStorage.getItem(`${KEY}xl`)).toBe("[60,40]");
    expect(window.localStorage.getItem(`${KEY}xl-right`)).toBe("[35,65]");
    expect(window.localStorage.getItem(`${KEY}lg`)).toBeNull();
  });
});
