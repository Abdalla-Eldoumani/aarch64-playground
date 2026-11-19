// An embed frame starts no emulator backend (the worker and its wasm) from the
// server's HTML through hydration, and starts one on the press that engages it.
// The hub is the real one; only pickBackend, where every backend starts, is faked.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

const pickBackend = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/emulator/backend")>()),
  pickBackend,
}));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";

const SRC = "main:\n        mov     x0, 7\n        ret\n";
const LESSON_FRAME = <EmbeddablePlayground chrome="embed" startSource={SRC} startStdin={"5\n"} />;

beforeEach(() => {
  // A start that never finishes: these cases count starts, not machines.
  pickBackend.mockImplementation(() => ({
    onSnapshot: () => () => {},
    init: () => new Promise(() => {}),
    dispose: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("an embed frame's backend", () => {
  it("does not start through the server render and hydration, which match", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      container.innerHTML = renderToString(LESSON_FRAME);
      await act(async () => {
        root = hydrateRoot(container, LESSON_FRAME, { onRecoverableError: recoverable });
      });
      expect(pickBackend).not.toHaveBeenCalled();
      expect(recoverable).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("starts once, on the press that engages the frame", () => {
    const { container } = render(LESSON_FRAME);
    expect(pickBackend).not.toHaveBeenCalled();
    act(() => {
      fireEvent.mouseDown(container.firstChild as Element);
    });
    act(() => {
      fireEvent.mouseDown(container.firstChild as Element);
    });
    expect(pickBackend).toHaveBeenCalledTimes(1);
  });
});
