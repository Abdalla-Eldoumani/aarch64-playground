// Pins the wait the lazy surfaces put beside their chunk import: it follows
// document.fonts.ready when the page has it, gives up at the limit when the
// fonts never settle, and never blocks where there is no font set at all.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fontsSettled } from "@/components/playground/fonts-settled";

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "fonts");
});

function installFonts(ready: Promise<void>) {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready },
  });
}

describe("fontsSettled", () => {
  it("resolves at once when the document has no font set", async () => {
    // jsdom ships no document.fonts, which is also the SSR shape.
    expect(document.fonts).toBeUndefined();
    await expect(fontsSettled(50)).resolves.toBeUndefined();
  });

  it("resolves when the fonts settle, before the limit", async () => {
    vi.useFakeTimers();
    let settle: () => void = () => {};
    installFonts(new Promise<void>((resolve) => (settle = resolve)));
    let done = false;
    void fontsSettled(10_000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(false);
    settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it("resolves at the limit when the fonts never settle", async () => {
    vi.useFakeTimers();
    installFonts(new Promise<void>(() => {}));
    let done = false;
    void fontsSettled(3000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
