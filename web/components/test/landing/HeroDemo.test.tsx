import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";

// The landing demo's contract with its reader: the walk steps on its own
// without ever moving focus or scrolling the page, holds while the demo is off
// screen or the tab is hidden, answers its pause and replay control, and under
// reduced motion waits for the reader to step it. The panels are the real
// ones; only the emulator hub is a stand-in, one that moves the marker a line
// per step the way the real one does.

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));
// The hero draws its program with the static view; the editor never mounts.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

import { HeroDemo } from "@/components/landing/HeroDemo";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";

// The hub a step at a time: null until the first assemble, then the number of
// steps taken since it. The marker starts on line 13, the program's first
// instruction, and the write reaches the console on step 9.
function useWalkingHub() {
  const [stepped, setStepped] = useState<number | null>(null);
  return useMemo(
    () =>
      makeHub({
        programLoaded: stepped !== null,
        currentLine: stepped === null ? null : 13 + stepped,
        stepCount: stepped ?? 0,
        changedRegs: new Set(stepped ? [stepped] : []),
        stdout: (stepped ?? 0) >= 9 ? "hello from the playground\n" : "",
        assemble: vi.fn(async () => {
          setStepped(0);
          return true;
        }),
        step: vi.fn(() => setStepped((n) => (n ?? 0) + 1)),
      }),
    [stepped],
  );
}

// One stand-in for both observers: the embed's engage and the walk's hold.
class FakeObserver {
  static all: FakeObserver[] = [];
  targets: Element[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.all.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.targets = [];
  }
  takeRecords() {
    return [];
  }
}

function setOnScreen(isIntersecting: boolean) {
  act(() => {
    for (const observer of FakeObserver.all) {
      if (observer.targets.length === 0) continue;
      observer["callback"](
        observer.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
        observer as unknown as IntersectionObserver,
      );
    }
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function markedLine(container: HTMLElement): string | null {
  return container.querySelector("[data-current]")?.getAttribute("data-line") ?? null;
}

// The program's own text holds the same words, so output is read from the
// console pane alone.
function consoleText(container: HTMLElement): string {
  return container.querySelector(".embed-area-console")?.textContent ?? "";
}

// Scrolled into view with no user input at all, the way the landing loads:
// the engage waits an idle slot, and so does the walk's first assemble.
async function arrive() {
  setOnScreen(true);
  await advance(0);
  await advance(0);
}

let scrollIntoView: ReturnType<typeof vi.fn<Element["scrollIntoView"]>>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeObserver.all = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  useEmulatorMock.mockImplementation(useWalkingHub);
  // jsdom has no scrollIntoView, so the spy stands in for it.
  scrollIntoView = vi.fn<Element["scrollIntoView"]>();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  localStorage.clear();
});

describe("HeroDemo", () => {
  it("walks the program line by line without moving focus or scrolling the page", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const { container } = render(<HeroDemo />);
    const before = document.activeElement;
    await arrive();
    expect(markedLine(container)).toBe("13");
    const seen: Array<string | null> = [];
    for (let i = 0; i < 10; i++) {
      await advance(450);
      seen.push(markedLine(container));
      expect(document.activeElement).toBe(before);
    }
    expect(seen).toEqual(["14", "15", "16", "17", "18", "19", "20", "21", "22", "23"]);
    expect(consoleText(container)).toContain("hello from the playground");
    expect(focus).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("pauses on the title bar's control and resumes where it stopped", async () => {
    const { container } = render(<HeroDemo />);
    await arrive();
    await advance(450 * 3);
    expect(markedLine(container)).toBe("16");
    fireEvent.click(screen.getByRole("button", { name: "pause the demo" }));
    await advance(3000);
    expect(markedLine(container)).toBe("16");
    fireEvent.click(screen.getByRole("button", { name: "play the demo" }));
    await advance(450);
    expect(markedLine(container)).toBe("17");
  });

  it("offers a replay once the walk is done, and walks again from the top", async () => {
    const { container } = render(<HeroDemo />);
    await arrive();
    await advance(450 * 10);
    expect(markedLine(container)).toBe("23");
    await advance(3000);
    expect(markedLine(container)).toBe("23");
    fireEvent.click(screen.getByRole("button", { name: "replay the demo" }));
    await advance(0);
    expect(markedLine(container)).toBe("13");
    await advance(450 * 2);
    expect(markedLine(container)).toBe("15");
    expect(screen.getByRole("button", { name: "pause the demo" })).toBeTruthy();
  });

  it("holds while the demo is off screen and picks up when it returns", async () => {
    const { container } = render(<HeroDemo />);
    await arrive();
    await advance(450 * 2);
    setOnScreen(false);
    await advance(3000);
    expect(markedLine(container)).toBe("15");
    setOnScreen(true);
    await advance(450);
    expect(markedLine(container)).toBe("16");
  });

  it("holds while the tab is hidden and picks up when it is shown", async () => {
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    try {
      const { container } = render(<HeroDemo />);
      await arrive();
      await advance(450);
      visibility = "hidden";
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await advance(3000);
      expect(markedLine(container)).toBe("14");
      visibility = "visible";
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await advance(450);
      expect(markedLine(container)).toBe("15");
    } finally {
      delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
    }
  });

  it("under reduced motion never moves on its own and steps once per press", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: /prefers-reduced-motion:\s*reduce/.test(query),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const { container } = render(<HeroDemo />);
    await arrive();
    await advance(5000);
    expect(markedLine(container)).toBeNull();
    const control = screen.getByRole("button", { name: "step through it" });
    fireEvent.click(control);
    await advance(0);
    expect(markedLine(container)).toBe("13");
    fireEvent.click(control);
    await advance(0);
    expect(markedLine(container)).toBe("14");
    await advance(5000);
    expect(markedLine(container)).toBe("14");
  });

  it("gives wheel and touch to the page until the reader clicks into the demo", async () => {
    const { container } = render(<HeroDemo />);
    await arrive();
    const frame = container.querySelector("[data-embed]") as HTMLElement;
    const code = screen.getByRole("group", { name: "program source" });
    expect(frame.hasAttribute("data-hands-off")).toBe(true);
    fireEvent.wheel(code);
    fireEvent.touchStart(code);
    expect(frame.hasAttribute("data-hands-off")).toBe(true);
    fireEvent.click(code);
    expect(frame.hasAttribute("data-hands-off")).toBe(false);
  });

  it("keeps the console still until a scrolling reader has been still for a second", async () => {
    const writes: number[] = [];
    const { container } = render(<HeroDemo />);
    await arrive();
    await advance(450 * 8);
    const box = container.querySelector(".embed-area-console .inner-scroll") as HTMLElement;
    vi.spyOn(box, "scrollTop", "set").mockImplementation(() => {
      writes.push(Date.now());
    });
    const wheelAt = Date.now();
    act(() => {
      window.dispatchEvent(new Event("wheel"));
    });
    // Step 9 prints 450 ms after the wheel; the box waits out the second.
    await advance(450);
    expect(consoleText(container)).toContain("hello from the playground");
    expect(writes).toEqual([]);
    await advance(549);
    expect(writes).toEqual([]);
    await advance(1);
    expect(writes).toEqual([wheelAt + 1000]);
  });

  it("names only the run button in the console's hint, since the demo has no step", async () => {
    render(<HeroDemo />);
    await arrive();
    expect(screen.getByText(/Press run under the editor/)).toBeTruthy();
    expect(screen.queryByText(/step or run/)).toBeNull();
  });
});
