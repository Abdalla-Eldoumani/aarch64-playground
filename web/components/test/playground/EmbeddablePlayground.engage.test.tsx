// The press or the focus that engages a frame lands on the control it was
// aimed at. A frame that swaps its pre-engage controls for live copies at the
// press loses the click (the pressed button is gone before it lands) and sends
// the focus to whichever live control shares the pressed one's name.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";

const SRC = "main:\n        mov     x0, 7\n        ret\n";

const side = () => screen.getByRole("group", { name: "registers or stack" });

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
  // jsdom implements no scrollIntoView, and the static view reveals its
  // current line on every change.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("the press and the focus that engage a frame", () => {
  it("shows the stack on the first press of the stack switch", () => {
    render(<EmbeddablePlayground chrome="embed" startSource={SRC} staticEditor readOnly />);
    const stack = within(side()).getByRole("button", { name: "stack" });
    act(() => {
      fireEvent.mouseDown(stack);
    });
    act(() => {
      fireEvent.mouseUp(stack);
      fireEvent.click(stack);
    });
    expect(within(side()).getByRole("button", { name: "stack" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the focus in the registers or stack switch when it engages the frame", () => {
    useEmulatorMock.mockReturnValue(makeHub({ isLoaded: false }));
    render(<EmbeddablePlayground chrome="embed" startSource={SRC} staticEditor readOnly />);
    act(() => within(side()).getByRole("button", { name: "registers" }).focus());
    // The group's name, so a miss says where the focus went instead.
    expect(document.activeElement?.closest('[role="group"]')?.getAttribute("aria-label")).toBe("registers or stack");
  });
});
