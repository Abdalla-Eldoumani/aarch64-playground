import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";

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
  loadProgram: vi.fn(),
  getSource: vi.fn(() => ""),
  getArgs: vi.fn(() => ""),
  getCursor: vi.fn(() => ({ line: 1, column: 1 })),
  getCommands: vi.fn(() => []),
}));

// The last props the stub received, so boot tests can assert what start
// buffer the page resolved without rendering the heavy surface.
const receivedPropsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/components/EmbeddablePlayground", async () => {
  const React = await import("react");
  return {
    EmbeddablePlayground: React.forwardRef(function Stub(
      props: Record<string, unknown>,
      ref: React.ForwardedRef<unknown>,
    ) {
      React.useEffect(() => {
        receivedPropsRef.current = props;
      });
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
import { buildShareHash } from "@/lib/share";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/playground");
  window.localStorage.clear();
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

describe("page boot and handoff", () => {
  it("boots a hard-loaded share hash into the start buffer without re-delivery", () => {
    window.history.replaceState(
      {},
      "",
      `/playground${buildShareHash({ source: "mov x9, 1", args: "a" })}`,
    );
    render(<Home />);
    expect(receivedPropsRef.current.startSource).toBe("mov x9, 1");
    expect(receivedPropsRef.current.startArgs).toBe("a");
    expect(receivedPropsRef.current.fromShare).toBe(true);
    // The boot consumed the hash; the post-mount pass must not apply it twice.
    expect(handle.loadProgram).not.toHaveBeenCalled();
  });

  it("boots the autosave when no handoff is in the URL", () => {
    window.localStorage.setItem(
      "aarch64-playground:auto-save:current",
      "// my saved work",
    );
    render(<Home />);
    expect(receivedPropsRef.current.startSource).toBe("// my saved work");
    expect(handle.loadProgram).not.toHaveBeenCalled();
  });

  it("delivers an ?example= deep link with its payload through loadProgram", async () => {
    window.history.replaceState({}, "", "/playground?example=echo");
    const routes: Record<string, string> = {
      "/examples/cpsc355/echo.s": "// echo source\n",
      "/examples/cpsc355/fixtures/echo.stdin": "hello\n",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: url in routes,
        status: url in routes ? 200 : 404,
        statusText: "",
        text: async () => routes[url] ?? "",
      })),
    );
    render(<Home />);
    await waitFor(() =>
      expect(handle.loadProgram).toHaveBeenCalledWith({
        source: "// echo source\n",
        label: "echo",
        stdin: "hello\n",
      }),
    );
  });

  it("keeps the booted buffer when the example fetch fails", async () => {
    window.history.replaceState({}, "", "/playground?example=missing");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "",
      })),
    );
    render(<Home />);
    // Let the rejected fetch settle; nothing may be delivered.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(handle.loadProgram).not.toHaveBeenCalled();
  });
});
