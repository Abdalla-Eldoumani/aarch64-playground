// Pins the interface walkthrough's behaviour: offered once on a first visit
// without taking focus, walked by buttons and arrow keys, closed at any step
// with the step kept for a resume, reset once finished, opened at the start by
// a deep link, put in the top layer where the popover API exists, and stepped
// aside while a picker's list is open.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InterfaceWalkthrough } from "@/components/playground/InterfaceWalkthrough";

const STORE_KEY = "aarch64-playground:walkthrough";
const stored = () => JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

function card() {
  return screen.getByRole("dialog");
}
function next() {
  return screen.getByRole("button", { name: /^(next|done)$/ });
}

function renderOpen(step = 0) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify({ offered: true, step }));
  const utils = render(<InterfaceWalkthrough openRequest={0} />);
  utils.rerender(<InterfaceWalkthrough openRequest={1} />);
  return utils;
}

describe("the first-visit offer", () => {
  it("arrives after a beat, once, and leaves focus where it was", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    render(<InterfaceWalkthrough openRequest={0} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByRole("heading", { name: "New to the playground?" })).toBeTruthy();
    expect(card().getAttribute("aria-modal")).toBe("false");
    expect(document.activeElement).toBe(outside);
    expect(stored()).toEqual({ offered: true, step: 0 });
    outside.remove();
  });

  it("is not made again once shown", () => {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ offered: true, step: 0 }));
    render(<InterfaceWalkthrough openRequest={0} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts at the first step, or goes away with not now", () => {
    render(<InterfaceWalkthrough openRequest={0} />);
    act(() => vi.advanceTimersByTime(1300));
    fireEvent.click(screen.getByRole("button", { name: "not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    window.localStorage.clear();
    render(<InterfaceWalkthrough openRequest={0} />);
    act(() => vi.advanceTimersByTime(1300));
    fireEvent.click(screen.getByRole("button", { name: "start the walkthrough" }));
    expect(screen.getByRole("heading", { name: "The editor" })).toBeTruthy();
    expect(document.activeElement).toBe(next());
  });
});

describe("walking the steps", () => {
  it("moves with next and back, and with the arrow keys", () => {
    renderOpen();
    expect(screen.getByText("1 of 15")).toBeTruthy();
    fireEvent.click(next());
    expect(screen.getByRole("heading", { name: "Files" })).toBeTruthy();
    fireEvent.keyDown(card(), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Assemble" })).toBeTruthy();
    fireEvent.keyDown(card(), { key: "ArrowLeft" });
    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(screen.getByRole("heading", { name: "The editor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "back" }).hasAttribute("disabled")).toBe(true);
  });

  it("closes at any step and resumes there", () => {
    const { rerender } = renderOpen(4);
    expect(screen.getByRole("heading", { name: "Step and continue" })).toBeTruthy();
    fireEvent.keyDown(card(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stored()).toEqual({ offered: true, step: 4 });
    rerender(<InterfaceWalkthrough openRequest={2} />);
    expect(screen.getByRole("heading", { name: "Step and continue" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close the walkthrough" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("finishes on the last step and starts over the next time", () => {
    const { rerender } = renderOpen(14);
    expect(screen.getByText("15 of 15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stored()).toEqual({ offered: true, step: 0 });
    rerender(<InterfaceWalkthrough openRequest={2} />);
    expect(screen.getByRole("heading", { name: "The editor" })).toBeTruthy();
  });

  it("gives focus back to what had it when it closes", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    renderOpen(2);
    expect(document.activeElement).toBe(next());
    fireEvent.keyDown(card(), { key: "Escape" });
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("gives focus to the tutorials button when what opened it is gone", () => {
    // A panel or palette that closes as the walkthrough opens takes its
    // button with it.
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const tutorials = document.createElement("button");
    tutorials.setAttribute("data-walkthrough", "tutorials");
    document.body.appendChild(tutorials);
    vi.spyOn(tutorials, "getBoundingClientRect").mockReturnValue({
      top: 8, left: 900, width: 90, height: 36, right: 990, bottom: 44, x: 900, y: 8, toJSON: () => ({}),
    } as DOMRect);
    renderOpen(5);
    expect(document.activeElement).toBe(next());
    opener.remove();
    fireEvent.keyDown(card(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(tutorials);
    tutorials.remove();
  });
});

describe("entry points and the top layer", () => {
  it("opens at the first step from ?walkthrough, with no offer first", () => {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ offered: true, step: 7 }));
    window.history.replaceState(null, "", "/playground?walkthrough=1");
    render(<InterfaceWalkthrough openRequest={0} />);
    expect(screen.getByRole("heading", { name: "The editor" })).toBeTruthy();
    expect(stored()).toEqual({ offered: true, step: 0 });
  });

  it("uses the popover API when the browser has it", () => {
    const show = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "showPopover", { value: show, configurable: true });
    try {
      renderOpen();
      expect(show).toHaveBeenCalledTimes(1);
      const layer = document.querySelector("[popover]");
      expect(layer?.getAttribute("popover")).toBe("manual");
      expect(layer?.querySelector('[role="dialog"]')).toBeTruthy();
    } finally {
      delete (HTMLElement.prototype as { showPopover?: unknown }).showPopover;
    }
  });

  it("steps aside while a picker's list is open and comes back when it closes", () => {
    renderOpen();
    const shown = () => document.querySelector<HTMLElement>('[role="dialog"]')?.style.visibility === "";
    // Monaco leaves its suggestion list in the page once it has shown, open
    // or not, so a listbox alone must not hide the card.
    const leftover = document.createElement("div");
    leftover.setAttribute("role", "listbox");
    document.body.appendChild(leftover);
    act(() => vi.advanceTimersByTime(500));
    expect(shown()).toBe(true);
    const picker = document.createElement("button");
    picker.setAttribute("aria-haspopup", "listbox");
    picker.setAttribute("aria-expanded", "true");
    document.body.appendChild(picker);
    act(() => vi.advanceTimersByTime(500));
    expect(shown()).toBe(false);
    picker.setAttribute("aria-expanded", "false");
    act(() => vi.advanceTimersByTime(500));
    expect(shown()).toBe(true);
    picker.remove();
    leftover.remove();
  });

  it("names the way in on a phone when the part is behind a tab", () => {
    const tab = document.createElement("button");
    tab.id = "phone-tab-code";
    document.body.appendChild(tab);
    vi.spyOn(tab, "getBoundingClientRect").mockReturnValue({
      top: 700, left: 0, width: 90, height: 44, right: 90, bottom: 744, x: 0, y: 700, toJSON: () => ({}),
    } as DOMRect);
    renderOpen(0);
    expect(screen.getByText(/the code tab shows it/)).toBeTruthy();
    tab.remove();
  });
});
