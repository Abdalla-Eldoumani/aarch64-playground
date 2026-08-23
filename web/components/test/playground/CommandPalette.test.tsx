// pins the command palette: opens as a modal with the search focused,
// lists every registered action with its shortcut, filters by query
// through cmdk with a no-matches empty state, runs the picked action
// then closes, and Escape closes without running anything. Focus is
// trapped while it is open and returns to whatever had it on close.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommandPalette } from "@/components/playground/CommandPalette";
import type { Action } from "@/lib/playground/commands";

beforeEach(() => {
  // cmdk's list measures itself with ResizeObserver and scrolls the
  // selected item into view; jsdom implements neither
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function makeActions(): Action[] {
  return [
    {
      id: "assemble",
      label: "assemble program",
      description: "build the current source",
      shortcut: "F6",
      run: vi.fn(),
    },
    {
      id: "theme",
      label: "toggle theme",
      description: "switch between dark and light",
      run: vi.fn(),
    },
  ];
}

function renderPalette(open = true) {
  const actions = makeActions();
  const onClose = vi.fn();
  render(<CommandPalette open={open} onClose={onClose} actions={actions} />);
  return { actions, onClose };
}

function input(): HTMLInputElement {
  return screen.getByPlaceholderText("type a command...") as HTMLInputElement;
}

describe("CommandPalette", () => {
  it("renders nothing while closed", () => {
    renderPalette(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens as a modal listing every action with label, description, and shortcut", () => {
    renderPalette();
    expect(screen.getByRole("dialog", { name: "command palette" })).toBeTruthy();
    expect(screen.getByText("assemble program")).toBeTruthy();
    expect(screen.getByText("build the current source")).toBeTruthy();
    expect(screen.getByText("F6")).toBeTruthy();
    expect(screen.getByText("toggle theme")).toBeTruthy();
  });

  it("focuses the search input on open", async () => {
    renderPalette();
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it("filters the list down to actions matching the query", () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: "theme" } });
    expect(screen.getByText("toggle theme")).toBeTruthy();
    expect(screen.queryByText("assemble program")).toBeNull();
  });

  it("shows the empty state when nothing matches", () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: "zzzz" } });
    expect(screen.getByText("no matches")).toBeTruthy();
    expect(screen.queryByText("toggle theme")).toBeNull();
  });

  it("runs the clicked action and closes", () => {
    const { actions, onClose } = renderPalette();
    fireEvent.click(screen.getByText("toggle theme"));
    expect(actions[1].run).toHaveBeenCalledTimes(1);
    expect(actions[0].run).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("runs the selected action on Enter", () => {
    const { actions, onClose } = renderPalette();
    fireEvent.change(input(), { target: { value: "assemble" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(actions[0].run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without running anything", () => {
    const { actions, onClose } = renderPalette();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions[0].run).not.toHaveBeenCalled();
    expect(actions[1].run).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the dialog instead of letting it reach the page behind", () => {
    renderPalette();
    // cmdk's rows are role="option" divs, so the search box is the card's
    // only tab stop: Tab off it wraps back to the box, and the default is
    // prevented so the browser cannot move focus out of the modal.
    const moved = fireEvent.keyDown(document, { key: "Tab" });
    expect(moved).toBe(false);
    expect(document.activeElement).toBe(input());
  });

  it("returns focus to whatever opened it", async () => {
    const actions = makeActions();
    const onClose = vi.fn();
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">open palette</button>
          <CommandPalette open={open} onClose={onClose} actions={actions} />
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    // jsdom's click does not move focus, so focus the trigger explicitly:
    // the trap captures whatever is active at open, and <body> would make
    // the assertion below pass for the wrong reason.
    const trigger = screen.getByRole("button", { name: "open palette" });
    trigger.focus();

    rerender(<Harness open />);
    await waitFor(() => expect(document.activeElement).toBe(input()));

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });
});
