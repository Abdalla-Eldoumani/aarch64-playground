import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

type Listener = (event: MessageEvent) => void;
let listeners: Set<Listener>;

beforeEach(() => {
  // The status store lives at module level; each test gets a fresh one.
  vi.resetModules();
  listeners = new Set();
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({ active: { postMessage: () => {} } }),
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    },
  });
});

afterEach(() => cleanup());

async function renderBadge(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
  const { OfflineBadge } = await import("@/components/chrome/OfflineBadge");
  const view = render(<OfflineBadge />);
  await act(async () => {});
  return view;
}

function send(status: Record<string, unknown>): void {
  const data = { type: "offline-status", bytes: 900, saving: null, failure: null, ...status };
  act(() => {
    for (const listener of listeners) listener(new MessageEvent("message", { data }));
  });
}

const statusText = (container: HTMLElement) =>
  container.querySelector('[role="status"]')?.textContent ?? null;

describe("OfflineBadge", () => {
  it("renders nothing when navigator.onLine is true", async () => {
    const { container } = await renderBadge(true);
    expect(container.firstChild).toBeNull();
  });

  it("promises nothing when no worker has answered", async () => {
    const { container } = await renderBadge(false);
    expect(statusText(container)).toBe("offline: other pages will load once you reconnect");
  });

  it("says the playground is saved and the other pages may not be", async () => {
    const { container } = await renderBadge(false);
    send({ savedAt: null });
    expect(statusText(container)).toBe(
      "offline: the playground works; other pages open only if saved or visited",
    );
  });

  it("says every page is saved, and since when, after a save", async () => {
    const { container } = await renderBadge(false);
    send({ savedAt: "2026-10-01T09:30:00.000Z" });
    expect(statusText(container)).toMatch(/^offline: every page is saved on this device \(saved .*2026\)$/);
  });
});
