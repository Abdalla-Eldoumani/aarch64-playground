// Pins the hero's static-editor configuration: the program is in the render
// before the embed engages, the pre-engage frame is the SAME grid the engaged
// frame is, the embed paints its panes before the hub finishes loading, full
// chrome keeps its loading beat, and a static view asked for without readOnly
// warns in development.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Monaco stays stubbed (jsdom must never instantiate the editor); the static
// view and the two panes are the real components, because whether they render
// against an unloaded hub is exactly what these cases pin.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
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
  it("renders the program before the embed engages, with no editor mount", () => {
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    expect(useEmulatorMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("mov");
    expect(container.textContent).toContain("ret");
    expect(screen.queryByTestId("editor")).toBeNull();
    expect(screen.queryByText("loading editor...")).toBeNull();
  });

  it("paints the same grid areas before and after the embed engages", () => {
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
    // The panes are the real components, so this also pins that both render
    // against no hub at all.
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

  it("keeps the loading beat for an embed without the prop", () => {
    render(<EmbeddablePlayground chrome="embed" startSource={SRC} readOnly />);
    expect(screen.getByText("loading editor...")).toBeTruthy();
  });

  it("renders the embed's editor, registers, and console before the hub loads", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    engage(container);
    expect(screen.queryByText("loading emulator...")).toBeNull();
    expect(container.querySelector(".embed-layout")).not.toBeNull();
    // The panes render their initial state rather than being withheld, so the
    // frame's layout is the same before and after the hub arrives.
    expect(screen.getByRole("heading", { name: "regfile" })).toBeTruthy();
    expect(container.querySelector(".embed-area-console")?.textContent).toContain(
      "console",
    );
  });

  it("still shows the loading beat for full chrome while the hub loads", () => {
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

  it("does not warn when the pair is passed as intended", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource={SRC} readOnly staticEditor />,
    );
    engage(container);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
