// Pins the save-every-page control against the messages the service worker
// sends: hidden until the worker answers, one button for every state, the
// request it sends, and what a screen reader hears when a save starts or ends.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

type Listener = (event: MessageEvent) => void;

let listeners: Set<Listener>;
let postMessage: ReturnType<typeof vi.fn>;
let persist: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // The status store lives at module level; each test gets a fresh one.
  vi.resetModules();
  listeners = new Set();
  postMessage = vi.fn();
  persist = vi.fn().mockResolvedValue(true);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({ active: { postMessage } }),
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    },
  });
  Object.defineProperty(navigator, "storage", { configurable: true, value: { persist } });
});

afterEach(() => {
  cleanup();
});

async function mount() {
  const { SaveOffline } = await import("@/components/chrome/SaveOffline");
  render(<SaveOffline />);
  // Lets the store's `ready` promise post its first question.
  await act(async () => {});
}

function send(data: Record<string, unknown>): void {
  act(() => {
    for (const listener of listeners) listener(new MessageEvent("message", { data }));
  });
}

const STATUS = {
  type: "offline-status",
  pages: 147,
  bytes: 2_408_523,
  savedAt: null,
  saving: null,
  failure: null,
};

const button = () => screen.getByRole("button");

describe("SaveOffline", () => {
  it("renders nothing until the worker answers, and asks it once", async () => {
    await mount();
    expect(screen.queryByRole("button")).toBeNull();
    expect(postMessage).toHaveBeenCalledWith({ type: "offline-status" });
  });

  it("offers to save every page with the download size, and asks for lasting storage", async () => {
    await mount();
    send(STATUS);
    expect(button().textContent).toBe("Save every page for offline2.4 MB");
    expect(button().getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(button());
    await act(async () => {});
    expect(persist).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenLastCalledWith({ type: "save-every-page" });
  });

  it("shows progress in the same button, which ignores presses meanwhile", async () => {
    await mount();
    send(STATUS);
    const before = button();
    send({ ...STATUS, saving: { done: 40, total: 147 } });
    expect(button()).toBe(before);
    expect(button().textContent).toBe("Saving every page40 of 147");
    expect(button().getAttribute("aria-disabled")).toBe("true");
    postMessage.mockClear();
    fireEvent.click(button());
    await act(async () => {});
    expect(postMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Saving every page for offline use.");
  });

  it("says when every page became available offline", async () => {
    await mount();
    send({ ...STATUS, saving: { done: 146, total: 147 } });
    send({ ...STATUS, savedAt: "2026-10-01T09:30:00.000Z" });
    const saved = new Date("2026-10-01T09:30:00.000Z").toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    expect(button().textContent).toBe(`Available offline${"saved " + saved}`);
    expect(button().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Every page is now available offline.");
  });

  it("explains a dropped connection and lets the reader try again", async () => {
    await mount();
    send({ ...STATUS, saving: { done: 3, total: 147 } });
    send({ ...STATUS, failure: "network" });
    // Once on screen and once in the announcement.
    expect(screen.getAllByText(/the connection dropped/)).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toMatch(/the connection dropped/);
    expect(button().getAttribute("aria-disabled")).toBe("false");
  });

  it("says when the device ran out of space, and lets the reader try again", async () => {
    await mount();
    send({ ...STATUS, failure: "storage" });
    expect(screen.getByText(/out of space/)).toBeTruthy();
    expect(button().getAttribute("aria-disabled")).toBe("false");
  });

  it("asks for a fresh start when the site was updated mid-save", async () => {
    await mount();
    send({ ...STATUS, failure: "update" });
    expect(screen.getByText(/the site was updated/)).toBeTruthy();
    expect(button().getAttribute("aria-disabled")).toBe("true");
  });

  it("announces nothing for the state it first loads in", async () => {
    await mount();
    send({ ...STATUS, savedAt: "2026-10-01T09:30:00.000Z" });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("ignores a message that is not a well-formed status", async () => {
    await mount();
    send({ ...STATUS, pages: -1 });
    send({ ...STATUS, savedAt: "not a date" });
    send({ ...STATUS, saving: { done: 5, total: 2 } });
    send({ type: "something-else" });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
