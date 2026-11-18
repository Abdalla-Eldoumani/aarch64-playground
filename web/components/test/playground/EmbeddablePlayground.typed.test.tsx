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

/** Serves the frame's HTML, types into the field named `label` before
 *  hydrating, hydrates, then engages the frame with a press. Returns the
 *  field's value afterwards. */
async function typeBeforeScript(frame: ReactElement, label: string, typed: string): Promise<string> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: ReturnType<typeof hydrateRoot> | undefined;
  // cleanup() knows nothing of this root: a failure must not leave a frame
  // in the page for the next case.
  try {
    container.innerHTML = renderToString(frame);
    (screen.getByLabelText(label) as HTMLInputElement).value = typed;
    await act(async () => {
      root = hydrateRoot(container, frame);
    });
    // Hydration keeps it; the press below is what must keep it too.
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(typed);
    await act(async () => {
      fireEvent.mouseDown(container.firstChild as Element);
    });
    return (screen.getByLabelText(label) as HTMLInputElement).value;
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
}

describe("text typed before the frame engages", () => {
  it("keeps the exercise's args box text", async () => {
    const frame = <EmbeddablePlayground chrome="checker" startSource={SRC} startArgs="12 7 30 4" showArgs />;
    expect(await typeBeforeScript(frame, "args", "1 2 3 4")).toBe("1 2 3 4");
  });

  it("keeps a lesson frame's Standard input text", async () => {
    const frame = <EmbeddablePlayground chrome="embed" startSource={SRC} />;
    expect(await typeBeforeScript(frame, "Standard input", "42")).toBe("42");
  });
});
