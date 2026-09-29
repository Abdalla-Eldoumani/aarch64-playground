// The landing page uses staticEditor so it never loads the code editor; its
// frame must look the same before and after the first press, or the page jumps.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Monaco stays stubbed (jsdom must never instantiate the editor); the static
// view and the two panes are the real components, because whether they render
// against an unloaded hub is exactly what these cases pin.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
  // The tablet arrangement reaches the panel library through PaneSplit;
  // these suites want the panes it wraps, not the split itself.
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div data-testid="pane-split">
      {first}
      {second}
    </div>
  ),
  EDITOR_SPLIT: { label: "resize editor and disassembly" },
  DEBUG_SPLIT: { label: "resize registers and tabs" },
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";

const SRC = "main:\n        mov     x0, 7\n        ret\n";

function engage(container: HTMLElement) {
  act(() => {
    fireEvent.mouseDown(container.firstChild as Element);
  });
}

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
  // jsdom implements no scrollIntoView, and the static view reveals its
  // current line on every change.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("EmbeddablePlayground staticEditor", () => {
  it("shows the program before the first press, without mounting the editor", () => {
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    expect(useEmulatorMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("mov");
    expect(container.textContent).toContain("ret");
    expect(screen.queryByTestId("editor")).toBeNull();
    expect(screen.queryByText("loading editor...")).toBeNull();
  });

  it("paints the same grid areas before and after the first press", () => {
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    const areas = () =>
      Array.from(container.querySelectorAll(".embed-grid > *")).map(
        (el) => (el.className.match(/embed-area-[a-z]+/) ?? [""])[0],
      );
    const before = areas();
    expect(before).toEqual([
      "embed-area-editor",
      "embed-area-registers",
      "embed-area-console",
    ]);
    // The panes are the real components, so this also checks that both render
    // with no emulator at all.
    expect(screen.getByRole("heading", { name: "regfile" })).toBeTruthy();
    expect(container.querySelector(".embed-area-editor")?.textContent).toContain(
      "mov",
    );

    engage(container);

    expect(areas()).toEqual(before);
    expect(container.querySelector(".embed-area-editor")?.textContent).toContain(
      "mov",
    );
  });

  it("passes the host's heading level to the registers label before and after engaging", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor registerHeadingLevel={3} />,
    );
    expect(screen.getByRole("heading", { name: "regfile", level: 3 })).toBeTruthy();
    engage(container);
    expect(screen.getByRole("heading", { name: "regfile", level: 3 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "regfile", level: 2 })).toBeNull();
  });

  it("gives focus back to the same control after focus engages the frame", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(<EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />);
    const before = screen.getByRole("group", { name: "register values" });
    act(() => before.focus());
    const after = screen.getByRole("group", { name: "register values" });
    // The live panes replaced the pre-engage copy, so the focus had to move.
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
  });

  it("gives focus back to a field named only by its <label>", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(
      <EmbeddablePlayground chrome="checker" startSource={SRC} startArgs="1 2" showArgs readOnly staticEditor />,
    );
    const before = screen.getByLabelText("args");
    act(() => before.focus());
    const after = screen.getByLabelText("args");
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
  });

  it("gives focus back to a button named only by its text", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(<EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />);
    const tab = () => within(screen.getByRole("group", { name: "view" })).getByRole("button", { name: "console" });
    const before = tab();
    act(() => before.focus());
    const after = tab();
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
  });

  it("still shows 'loading editor...' for an embed without staticEditor", () => {
    render(<EmbeddablePlayground chrome="embed" startSource={SRC} readOnly />);
    expect(screen.getByText("loading editor...")).toBeTruthy();
  });

  it("renders the embed's editor, registers, and console before the emulator loads", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    engage(container);
    expect(screen.queryByText("loading emulator...")).toBeNull();
    expect(container.querySelector(".embed-layout")).not.toBeNull();
    // The panes render their initial state rather than being withheld, so the
    // frame's layout is the same before and after the emulator loads.
    expect(screen.getByRole("heading", { name: "regfile" })).toBeTruthy();
    expect(container.querySelector(".embed-area-console")?.textContent).toContain(
      "console",
    );
  });

  it("still shows 'loading emulator...' in full chrome while the emulator loads", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(<EmbeddablePlayground chrome="full" startSource={SRC} />);
    expect(screen.getByText("loading emulator...")).toBeTruthy();
  });

  it("warns in development when staticEditor arrives without readOnly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} staticEditor />,
    );
    engage(container);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("readOnly");
    warn.mockRestore();
  });

  it("does not warn when staticEditor comes with readOnly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    engage(container);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
