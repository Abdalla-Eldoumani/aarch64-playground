// pins what the laptop layout itself owns, with the panel library mocked
// away: the four-pane arrangement (an outer horizontal split, a vertical
// split inside each column), which slot each child lands in, the three
// localStorage keys the breakpoint prop derives, the size mapping in both
// directions (a persisted array becomes the panes' default sizes, and a
// finished drag is written back by panel id, with a missing id keeping the
// size it already had rather than collapsing the pane to zero), and the grip
// on every seam: its name, the band it draws, and the double-click that puts
// its group back to the authored split. Keyboard resizing belongs to the
// library and is pinned against the real one in ResizableLayout.keyboard.test.tsx.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";

type Layout = Record<string, number>;
type GroupHandle = { getLayout: () => Layout; setLayout: (l: Layout) => Layout };

// The real Group hands onLayoutChange to a drag gesture behind a
// ResizeObserver jsdom does not have. The mock parks the callback on the
// group's own DOM node, so a test can fire it exactly as a finished drag
// would without a synthetic pointer.
const dragHandlers = vi.hoisted(() => new WeakMap<Element, (l: Layout) => void>());
// Every layout pushed through a group's imperative handle: the only way a
// stored or reset split can move a group that is already mounted.
const setLayoutCalls = vi.hoisted(() => [] as Layout[]);
// What each mocked group currently believes its layout to be. The real
// library moves first and reports afterwards, so the tests have to model that
// or the component's own reconcile effect reads a stale layout.
const groupLayouts = vi.hoisted(() => new WeakMap<Element, { layout: Layout }>());

vi.mock("react-resizable-panels", async () => {
  const { useRef } = await import("react");
  return {
    useGroupRef: () => useRef<GroupHandle | null>(null),
    Group: ({
      orientation,
      defaultLayout,
      onLayoutChange,
      groupRef,
      children,
    }: {
      orientation: string;
      defaultLayout: Layout;
      onLayoutChange: (l: Layout) => void;
      groupRef?: { current: GroupHandle | null };
      children: ReactNode;
    }) => (
      <div
        data-group={orientation}
        data-layout={JSON.stringify(defaultLayout)}
        ref={(el) => {
          if (!el) return;
          dragHandlers.set(el, onLayoutChange);
          let state = groupLayouts.get(el);
          if (!state) {
            state = { layout: { ...defaultLayout } };
            groupLayouts.set(el, state);
          }
          const held = state;
          if (groupRef) {
            groupRef.current = {
              getLayout: () => held.layout,
              setLayout: (l: Layout) => {
                setLayoutCalls.push(l);
                held.layout = { ...l };
                return l;
              },
            };
          }
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
    Separator: ({
      children,
      className,
      disableDoubleClick,
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      disableDoubleClick?: boolean;
    } & Record<string, unknown>) => (
      <div
        {...rest}
        role="separator"
        tabIndex={0}
        data-separator=""
        data-library-doubleclick={disableDoubleClick ? "off" : "on"}
        className={className}
      >
        {children}
      </div>
    ),
  };
});

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

/** The grip between a named pair of panes. */
function grip(label: string): HTMLElement {
  const el = document.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`no grip labelled ${label}`);
  return el as HTMLElement;
}

function drag(paneId: string, layout: Layout): void {
  const el = group(paneId);
  const handler = dragHandlers.get(el);
  if (!handler) throw new Error(`no drag handler for ${paneId}`);
  // The library resizes the group and only then reports the new layout.
  const state = groupLayouts.get(el);
  if (state) state.layout = { ...state.layout, ...layout };
  act(() => handler(layout));
}

afterEach(() => {
  cleanup();
  setLayoutCalls.length = 0;
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

  it("names each seam after the two panes it sits between", () => {
    renderLayout();
    const labels = Array.from(document.querySelectorAll('[role="separator"]')).map(
      (el) => el.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "resize editor and disassembly",
      "resize editor and debug column",
      "resize registers and tabs",
    ]);
  });

  it("draws every seam as a band with a grip mark and a focus ring", () => {
    renderLayout();
    const seams = Array.from(document.querySelectorAll('[role="separator"]'));
    expect(seams.length).toBe(3);
    for (const seam of seams) {
      const cls = seam.getAttribute("class") ?? "";
      expect(cls).toContain("bg-[var(--border)]");
      expect(cls).toContain("hover:bg-[var(--cyan)]");
      expect(cls).toContain("data-[separator=active]:bg-[var(--cyan)]");
      expect(cls).toContain("focus-visible:[box-shadow:var(--ring)]");
      // The mark's rest ink is --bg-base, not --border-strong: high-contrast
      // gives both border tokens the same #FFFFFF, so a --border-strong mark
      // is white on a white band.
      const mark = seam.querySelector('[aria-hidden="true"]');
      expect(mark).toBeTruthy();
      const markCls = mark?.getAttribute("class") ?? "";
      expect(markCls).toContain("bg-[var(--bg-base)]");
      expect(markCls).toContain("group-data-[separator=active]/grip:bg-[var(--cyan-dim)]");
    }
  });

  it("sizes and points each seam along its own axis", () => {
    renderLayout();
    const outer = grip("resize editor and debug column").getAttribute("class") ?? "";
    expect(outer).toContain("w-1.5");
    expect(outer).toContain("cursor-col-resize");
    const inner = grip("resize registers and tabs").getAttribute("class") ?? "";
    expect(inner).toContain("h-1.5");
    expect(inner).toContain("cursor-row-resize");
  });

  it("puts a group back to its authored split on a double-click", () => {
    renderLayout();
    drag("panel-left", { "panel-left": 30, "panel-right": 70 });
    expect(window.localStorage.getItem(`${KEY}lg`)).toBe("[30,70]");

    fireEvent.doubleClick(grip("resize editor and debug column"));
    expect(setLayoutCalls).toEqual([{ "panel-left": 55, "panel-right": 45 }]);
    expect(window.localStorage.getItem(`${KEY}lg`)).toBe("[55,45]");
  });

  it("resets only the group whose seam was double-clicked", () => {
    renderLayout();
    drag("panel-left", { "panel-left": 30, "panel-right": 70 });
    drag("panel-regs", { "panel-regs": 80, "panel-tabs": 20 });

    fireEvent.doubleClick(grip("resize registers and tabs"));
    expect(setLayoutCalls).toEqual([{ "panel-regs": 45, "panel-tabs": 55 }]);
    expect(window.localStorage.getItem(`${KEY}lg-right`)).toBe("[45,55]");
    expect(window.localStorage.getItem(`${KEY}lg`)).toBe("[30,70]");
  });

  it("stands the library's own double-click down so the two cannot fight", () => {
    // The library's reset takes a panel back to its `defaultSize`, which here
    // is the PERSISTED size; the authored split is ours to restore.
    renderLayout();
    const flags = Array.from(document.querySelectorAll('[role="separator"]')).map(
      (el) => el.getAttribute("data-library-doubleclick"),
    );
    expect(flags).toEqual(["off", "off", "off"]);
  });
  it("pushes a stored split onto the group the first render could not carry", () => {
    // useLayoutPersistence reads localStorage in an effect, and the library
    // reads defaultLayout only at mount, so the stored sizes have to be put
    // on the mounted group by hand or a reload loses them.
    window.localStorage.setItem(`${KEY}lg`, "[30,70]");
    renderLayout();
    expect(setLayoutCalls).toEqual([{ "panel-left": 30, "panel-right": 70 }]);
  });

  it("leaves a group alone when the stored split is the one it mounted with", () => {
    window.localStorage.setItem(`${KEY}lg`, "[55,45]");
    window.localStorage.setItem(`${KEY}lg-left`, "[70,30]");
    window.localStorage.setItem(`${KEY}lg-right`, "[45,55]");
    renderLayout();
    expect(setLayoutCalls).toEqual([]);
  });

  it("does not push a finished drag back at the group that reported it", () => {
    renderLayout();
    drag("panel-left", { "panel-left": 40, "panel-right": 60 });
    expect(setLayoutCalls).toEqual([]);
  });
});
