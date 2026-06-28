import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

// page.tsx is the single keyboard-shortcut owner: it drives the playground
// purely through the imperative handle, and Controls (full chrome only) no
// longer binds keys. Mock the heavy surface and the page modals so the test
// exercises only the page's keydown routing and proves each execution key
// fires exactly once (no double-fire) with no shortcut lost.
const handle = vi.hoisted(() => ({
  assemble: vi.fn(),
  run: vi.fn(),
  pause: vi.fn(),
  step: vi.fn(),
  stepBack: vi.fn(),
  reset: vi.fn(),
  loadSource: vi.fn(),
  getSource: vi.fn(() => ""),
  getArgs: vi.fn(() => ""),
  getCursor: vi.fn(() => ({ line: 1, column: 1 })),
  getCommands: vi.fn(() => []),
}));

vi.mock("@/components/EmbeddablePlayground", async () => {
  const React = await import("react");
  return {
    EmbeddablePlayground: React.forwardRef(function Stub(
      _props: Record<string, unknown>,
      ref: React.ForwardedRef<unknown>,
    ) {
      React.useImperativeHandle(ref, () => handle, []);
      return null;
    }),
  };
});
vi.mock("@/components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/ShortcutsHelp", () => ({ ShortcutsHelp: () => null }));
vi.mock("@/components/ShareDialog", () => ({ ShareDialog: () => null }));
vi.mock("@/components/SiteNav", () => ({ SiteNav: () => null }));

import Home from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("page keyboard ownership", () => {
  it("routes F10 to a single step (no double-fire)", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F10" });
    expect(handle.step).toHaveBeenCalledTimes(1);
    expect(handle.stepBack).not.toHaveBeenCalled();
  });

  it("routes Shift+F10 to step back", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F10", shiftKey: true });
    expect(handle.stepBack).toHaveBeenCalledTimes(1);
    expect(handle.step).not.toHaveBeenCalled();
  });

  it("routes F6 to assemble", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F6" });
    expect(handle.assemble).toHaveBeenCalledTimes(1);
  });

  it("routes F5 to a single run", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F5" });
    expect(handle.run).toHaveBeenCalledTimes(1);
    expect(handle.pause).not.toHaveBeenCalled();
  });

  it("routes Shift+F5 to reset", () => {
    render(<Home />);
    fireEvent.keyDown(window, { key: "F5", shiftKey: true });
    expect(handle.reset).toHaveBeenCalledTimes(1);
  });
});
