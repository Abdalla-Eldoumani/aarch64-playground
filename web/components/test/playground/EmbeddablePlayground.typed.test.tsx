// Text typed into an embed's args box or its "Standard input" box before the
// page's script ran is still there once the frame engages. Hydration leaves it
// in the server-rendered field; the frame must not drop it when the machine
// arrives.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";

const SRC = "main:\n        mov     x0, 7\n        ret\n";

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Serves the frame's HTML, types into the field named `label` before
 *  hydrating, hydrates, then engages the frame with a press. Returns the
 *  field's value once hydrated and once engaged. */
async function typeBeforeScript(
  frame: ReactElement,
  label: string,
  typed: string,
): Promise<{ hydrated: string; engaged: string }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: ReturnType<typeof hydrateRoot> | undefined;
  const value = () => (screen.getByLabelText(label) as HTMLInputElement).value;
  // cleanup() knows nothing of this root: a failure must not leave a frame
  // in the page for the next case.
  try {
    container.innerHTML = renderToString(frame);
    (screen.getByLabelText(label) as HTMLInputElement).value = typed;
    await act(async () => {
      root = hydrateRoot(container, frame);
    });
    const hydrated = value();
    await act(async () => {
      fireEvent.mouseDown(container.firstChild as Element);
    });
    return { hydrated, engaged: value() };
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
}

const ARGS_FRAME = <EmbeddablePlayground chrome="checker" startSource={SRC} startArgs="12 7 30 4" showArgs />;
const LESSON_FRAME = <EmbeddablePlayground chrome="embed" startSource={SRC} />;

describe("text typed before the frame engages", () => {
  it("keeps the exercise's args box text", async () => {
    expect(await typeBeforeScript(ARGS_FRAME, "args", "1 2 3 4")).toEqual({ hydrated: "1 2 3 4", engaged: "1 2 3 4" });
  });

  it("keeps a lesson frame's Standard input text", async () => {
    expect(await typeBeforeScript(LESSON_FRAME, "Standard input", "42")).toEqual({ hydrated: "42", engaged: "42" });
  });

  // Each of these re-renders the field before anything engages the frame.
  it("keeps the args box text when the stack side was chosen on an earlier page", async () => {
    window.localStorage.setItem("aarch64-playground:embed-stack", "1");
    expect(await typeBeforeScript(ARGS_FRAME, "args", "1 2 3 4")).toEqual({ hydrated: "1 2 3 4", engaged: "1 2 3 4" });
  });

  it("keeps the Standard input text on a touch screen", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(pointer: coarse)",
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    expect(await typeBeforeScript(LESSON_FRAME, "Standard input", "42")).toEqual({ hydrated: "42", engaged: "42" });
  });
});
