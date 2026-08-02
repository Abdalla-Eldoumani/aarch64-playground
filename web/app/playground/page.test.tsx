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
  notifyError: vi.fn(),
}));

// The last props the stub received, so boot tests can assert what start
// buffer the page resolved without rendering the heavy surface.
const receivedPropsRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/components/playground/EmbeddablePlayground", async () => {
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
vi.mock("@/components/playground/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/playground/ShortcutsHelp", () => ({ ShortcutsHelp: () => null }));
vi.mock("@/components/playground/ShareDialog", () => ({ ShareDialog: () => null }));
vi.mock("@/components/chrome/SiteNav", () => ({ SiteNav: () => null }));

// Boot failures surface through the playground handle's notifyError (the
// page entry's own toast binding is a dead module instance in prod); the
// tests observe the handle mock.
const toastError = () => handle.notifyError as ReturnType<typeof vi.fn>;

import Home from "./page";
import { buildShareHash } from "@/lib/playground/share";

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
        stem: "echo",
        stdin: "hello\n",
      }),
    );
  });

  it("applies ?run= to the example payload, and only to an example", async () => {
    window.history.replaceState({}, "", "/playground?example=echo&run=terminal");
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
        stem: "echo",
        stdin: "hello\n",
        launch: "terminal",
      }),
    );
  });

  it("leaves the example's own default in place when ?run= is unknown", async () => {
    window.history.replaceState({}, "", "/playground?example=echo&run=interactive");
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
    await waitFor(() => expect(handle.loadProgram).toHaveBeenCalled());
    const payload = (handle.loadProgram as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as { launch?: string };
    expect(payload.launch).toBeUndefined();
  });

  it("ignores ?run= with no ?example=: there is no program to own", async () => {
    window.history.replaceState({}, "", "/playground?run=terminal");
    render(<Home />);
    // No delivery at all: the autosaved buffer is not a program handoff.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(handle.loadProgram).not.toHaveBeenCalled();
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
    // ...but the student is told: the old empty catch shipped the wrong
    // buffer to a whole class off one typo'd instructor link, silently.
    // Boot toasts fire on a short delay (the Toaster subscribes after the
    // first commit), so wait past it.
    await waitFor(() => expect(toastError()).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(String(toastError().mock.calls[0][0])).toContain("404");
  });

  it("reports a damaged share link instead of silently booting the autosave", async () => {
    window.history.replaceState({}, "", "/playground#p2=z");
    render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(handle.loadProgram).not.toHaveBeenCalled();
    await waitFor(() => expect(toastError()).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(String(toastError().mock.calls[0][0])).toContain("damaged");
  });
});

describe("page delivery on a URL change without a remount", () => {
  // `boot` is captured once at mount, so a URL that changes underneath this
  // page (the back button, or a second share link pasted into the address
  // bar of an open tab) used to deliver nothing at all.
  it("delivers a share hash that arrives after mount", async () => {
    render(<Home />);
    expect(handle.loadProgram).not.toHaveBeenCalled();

    window.history.replaceState(
      {},
      "",
      `/playground${buildShareHash({ source: "mov x4, 9", args: "z" })}`,
    );
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    await waitFor(() => expect(handle.loadProgram).toHaveBeenCalledTimes(1));
    expect(handle.loadProgram.mock.calls[0][0]).toMatchObject({
      source: "mov x4, 9",
      args: "z",
      fromShare: true,
    });
  });

  it("does not re-deliver the URL the boot already consumed", async () => {
    const hash = buildShareHash({ source: "mov x9, 1" });
    window.history.replaceState({}, "", `/playground${hash}`);
    render(<Home />);
    expect(handle.loadProgram).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(handle.loadProgram).not.toHaveBeenCalled();
  });

  it("reports a damaged link that arrives after mount", async () => {
    render(<Home />);
    window.history.replaceState({}, "", "/playground#p2=z");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(toastError()).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(String(toastError().mock.calls[0][0])).toContain("damaged");
    expect(handle.loadProgram).not.toHaveBeenCalled();
  });
});
