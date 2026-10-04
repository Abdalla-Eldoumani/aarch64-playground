// pins the shortcuts modal: closed renders nothing so focus stays put,
// open lists every shortcut as description plus kbd keys, focus lands
// inside the trap, and it closes from button, backdrop, and Escape.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShortcutsHelp } from "@/components/playground/ShortcutsHelp";

afterEach(() => cleanup());

const SHORTCUTS = [
  { keys: "F5", description: "run program" },
  { keys: "F10", description: "step one instruction" },
];

function renderHelp(open = true) {
  const onClose = vi.fn();
  render(<ShortcutsHelp open={open} onClose={onClose} shortcuts={SHORTCUTS} />);
  return onClose;
}

describe("ShortcutsHelp", () => {
  it("renders nothing while closed", () => {
    renderHelp(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists every shortcut as a description with its keys in a kbd", () => {
    renderHelp();
    expect(screen.getByRole("dialog", { name: "keyboard shortcuts" })).toBeTruthy();
    for (const s of SHORTCUTS) {
      expect(screen.getByText(s.description)).toBeTruthy();
      const kbd = screen.getByText(s.keys);
      expect(kbd.tagName).toBe("KBD");
    }
  });

  it("scrolls the list in its own keyboard-reachable box, outside the heading and close", () => {
    // A phone's screen is shorter than the whole list; only the list may
    // scroll away, so the heading and the way out stay on screen.
    renderHelp();
    const list = screen.getByRole("region", { name: "shortcut list" });
    expect(list.getAttribute("tabindex")).toBe("0");
    expect(list.contains(screen.getByText("run program"))).toBe(true);
    expect(list.contains(screen.getByRole("heading", { name: "Keyboard shortcuts" }))).toBe(false);
    expect(list.contains(screen.getByRole("button", { name: "close" }))).toBe(false);
  });

  it("moves focus into the modal on open, onto the list a keyboard scrolls", () => {
    renderHelp();
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "shortcut list" }));
  });

  it("closes from the close button, the backdrop, and Escape, but not inner clicks", () => {
    // The backdrop ignores a click in the first half second (a double tap's
    // second tap), so the clock moves past it before the backdrop is clicked.
    let now = 1000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      const onClose = renderHelp();
      fireEvent.click(screen.getByText("run program"));
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "close" }));
      now += 600;
      fireEvent.click(screen.getByRole("dialog", { name: "keyboard shortcuts" }));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(3);
    } finally {
      clock.mockRestore();
    }
  });
});
