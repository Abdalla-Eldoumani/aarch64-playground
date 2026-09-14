// pins which arrangement each width gets and, at tablet, that the two
// half-width columns are real vertical splits: same grips, same labels, and
// their own persistence keys, so a tablet reader's sizes never land on the
// laptop layout's entries.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";

type Layout = Record<string, number>;

// Same shape as the ResizableLayout suite's mock: the real Group needs a
// ResizeObserver jsdom does not have, so the layout callback is parked on the
// group's node instead of being reached through a synthetic drag.
const dragHandlers = vi.hoisted(() => new WeakMap<Element, (l: Layout) => void>());

// Every layout pushed through a group's imperative handle: the way a stored
// split reaches a group that is already mounted.
const setLayoutCalls = vi.hoisted(() => [] as Layout[]);

vi.mock("react-resizable-panels", async () => {
  const { useRef } = await import("react");
  return {
    useGroupRef: () =>
      useRef<{ getLayout: () => Layout; setLayout: (l: Layout) => Layout } | null>(null),
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
      groupRef?: { current: { getLayout: () => Layout; setLayout: (l: Layout) => Layout } | null };
      children: ReactNode;
    }) => (
      <div
        data-group={orientation}
        data-layout={JSON.stringify(defaultLayout)}
        ref={(el) => {
          if (!el) return;
          dragHandlers.set(el, onLayoutChange);
          if (groupRef) {
            groupRef.current = {
              getLayout: () => defaultLayout,
              setLayout: (l: Layout) => {
                setLayoutCalls.push(l);
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
      ...rest
    }: { children?: ReactNode; className?: string } & Record<string, unknown>) => (
      <div {...rest} role="separator" tabIndex={0} className={className}>
        {children}
      </div>
    ),
  };
});

import { FullLayout } from "@/components/playground/FullLayout";
import type { Breakpoint } from "@/lib/hooks/use-breakpoint";

const KEY = "aarch64-playground:layout:";

const PANES = {
  memory: <span>MEMORY</span>,
  stack: <span>STACK</span>,
  console: <span>CONSOLE</span>,
  terminal: <span>TERMINAL</span>,
  watches: <span>WATCHES</span>,
  converter: <span>CONVERTER</span>,
  memwatch: <span>MEMWATCH</span>,
  saves: <span>SAVES</span>,
};

function renderLayout(breakpoint: Breakpoint) {
  return render(
    <FullLayout
      breakpoint={breakpoint}
      editor={<span>EDITOR</span>}
      disassembly={<span>DISASM</span>}
      registers={<span>REGS</span>}
      rightTabs={<span>TABS</span>}
      panes={PANES}
      consoleBlocked={false}
    />,
  );
}

function panel(id: string): HTMLElement {
  const el = document.querySelector(`[data-panel="${id}"]`);
  if (!el) throw new Error(`no pane ${id}`);
  return el as HTMLElement;
}

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
  setLayoutCalls.length = 0;
  cleanup();
  window.localStorage.clear();
});

describe("FullLayout", () => {
  it("gives the tablet two vertical splits instead of two fixed halves", () => {
    renderLayout("md");
    const groups = Array.from(document.querySelectorAll("[data-group]"));
    expect(groups.map((g) => g.getAttribute("data-group"))).toEqual([
      "vertical",
      "vertical",
    ]);
    expect(
      Array.from(groups[0].children)
        .filter((c) => c.hasAttribute("data-panel"))
        .map((c) => c.getAttribute("data-panel")),
    ).toEqual(["panel-editor", "panel-disasm"]);
    expect(
      Array.from(groups[1].children)
        .filter((c) => c.hasAttribute("data-panel"))
        .map((c) => c.getAttribute("data-panel")),
    ).toEqual(["panel-regs", "panel-tabs"]);
    expect(panel("panel-editor").textContent).toBe("EDITOR");
    expect(panel("panel-disasm").textContent).toBe("DISASM");
    expect(panel("panel-regs").textContent).toBe("REGS");
    expect(panel("panel-tabs").textContent).toBe("TABS");
  });

  it("wears the same two grips the laptop layout wears", () => {
    renderLayout("md");
    const labels = Array.from(document.querySelectorAll('[role="separator"]')).map(
      (el) => el.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "resize editor and disassembly",
      "resize registers and tabs",
    ]);
    for (const seam of document.querySelectorAll('[role="separator"]')) {
      const cls = seam.getAttribute("class") ?? "";
      expect(cls).toContain("h-1.5");
      expect(cls).toContain("cursor-row-resize");
      expect(cls).toContain("focus-visible:[box-shadow:var(--ring)]");
    }
  });

  it("opens the tablet columns on the authored splits", () => {
    renderLayout("md");
    expect(panel("panel-editor").getAttribute("data-size")).toBe("70%");
    expect(panel("panel-disasm").getAttribute("data-size")).toBe("30%");
    expect(panel("panel-regs").getAttribute("data-size")).toBe("45%");
    expect(panel("panel-tabs").getAttribute("data-size")).toBe("55%");
  });

  it("keeps the tablet sizes under their own two keys", () => {
    renderLayout("md");
    drag("panel-editor", { "panel-editor": 60, "panel-disasm": 40 });
    drag("panel-regs", { "panel-regs": 30, "panel-tabs": 70 });
    expect(window.localStorage.getItem(`${KEY}md-left`)).toBe("[60,40]");
    expect(window.localStorage.getItem(`${KEY}md-right`)).toBe("[30,70]");
    expect(window.localStorage.getItem(`${KEY}lg-left`)).toBeNull();
    expect(window.localStorage.getItem(`${KEY}lg-right`)).toBeNull();
  });

  it("reopens the tablet on the sizes a previous visit stored", () => {
    window.localStorage.setItem(`${KEY}md-left`, "[85,15]");
    window.localStorage.setItem(`${KEY}md-right`, "[20,80]");
    renderLayout("md");
    // The Panels open on the authored split; the stored one is pushed
    // through each group's handle once the storage read has run.
    expect(panel("panel-editor").getAttribute("data-size")).toBe("70%");
    expect(panel("panel-regs").getAttribute("data-size")).toBe("45%");
    // Exactly one push per group: a second would be the reconcile loop.
    expect(setLayoutCalls).toHaveLength(2);
    expect(setLayoutCalls).toEqual(
      expect.arrayContaining([
        { "panel-editor": 85, "panel-disasm": 15 },
        { "panel-regs": 20, "panel-tabs": 80 },
      ]),
    );
  });

  it("hands laptop widths the four-pane resizable layout instead", () => {
    renderLayout("lg");
    expect(document.querySelector('[data-panel="panel-left"]')).toBeTruthy();
    expect(document.querySelectorAll('[role="separator"]').length).toBe(3);
  });

  it("hands phone widths the single-pane layout, with no split at all", () => {
    renderLayout("sm");
    expect(document.querySelectorAll("[data-group]").length).toBe(0);
    expect(document.querySelectorAll('[role="separator"]').length).toBe(0);
  });
});
