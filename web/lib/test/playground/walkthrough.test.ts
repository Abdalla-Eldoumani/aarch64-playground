// Pins the interface walkthrough's data and geometry: the steps cover every
// part the walkthrough promises, a card is placed beside its target without
// covering it whenever the screen has room, the first on-screen target wins,
// and a broken store never breaks the page.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WALKTHROUGH_STEPS,
  loadProgress,
  placeCard,
  resolveTarget,
  saveProgress,
  type Box,
  type Placement,
} from "@/lib/playground/walkthrough";

const STORE_KEY = "aarch64-playground:walkthrough";

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the steps", () => {
  it("walk the parts of the interface in order", () => {
    expect(WALKTHROUGH_STEPS.map((s) => s.id)).toEqual([
      "editor",
      "files",
      "assemble",
      "run",
      "step",
      "breakpoints",
      "registers",
      "memory",
      "console",
      "converter",
      "share",
      "export",
      "diagnostic",
      "commands",
      "help",
    ]);
  });

  it("each has words to show and somewhere to point", () => {
    for (const step of WALKTHROUGH_STEPS) {
      expect(step.title.trim(), step.id).not.toBe("");
      expect(step.body.trim(), step.id).not.toBe("");
      expect(step.targets.length, step.id).toBeGreaterThan(0);
      for (const t of step.targets) expect(() => document.querySelector(t.selector), t.selector).not.toThrow();
    }
  });

  it("the views a phone keeps behind its tabs point at those tabs first", () => {
    const first = (id: string) => WALKTHROUGH_STEPS.find((s) => s.id === id)?.targets[0].selector;
    // Registers and console only while their view is not already up.
    expect(first("registers")).toBe('#phone-tab-regs[aria-selected="false"]');
    expect(first("console")).toBe('#phone-tab-console[aria-selected="false"]');
    expect(first("memory")).toBe("#phone-tab-more");
    expect(first("converter")).toBe("#phone-tab-more");
  });
});

function overlaps(a: Box, p: Placement, height: number): boolean {
  return (
    a.left < p.left + p.width &&
    p.left < a.left + a.width &&
    a.top < p.top + height &&
    p.top < a.top + a.height
  );
}

describe("placeCard", () => {
  const card = { width: 352, height: 200 };
  const desk = { width: 1440, height: 900 };
  const phone = { width: 390, height: 844 };

  function check(target: Box, view: { width: number; height: number }): Placement {
    const p = placeCard(target, card, view);
    const height = p.maxHeight ?? card.height;
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + p.width).toBeLessThanOrEqual(view.width - 8);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + height).toBeLessThanOrEqual(view.height - 8);
    return p;
  }

  it("goes under a header button", () => {
    const share = { top: 48, left: 874, width: 50, height: 36 };
    const p = check(share, desk);
    expect(p.side).toBe("below");
    expect(overlaps(share, p, 200)).toBe(false);
  });

  it("keeps a card for a button at the right edge on screen", () => {
    const commands = { top: 48, left: 1257, width: 132, height: 36 };
    const p = check(commands, desk);
    expect(p.left + p.width).toBe(1440 - 8);
  });

  it("goes over a run control at the bottom", () => {
    const run = { top: 850, left: 120, width: 80, height: 44 };
    const p = check(run, desk);
    expect(p.side).toBe("above");
    expect(overlaps(run, p, 200)).toBe(false);
  });

  it("goes beside a column that fills the height", () => {
    const editor = { top: 90, left: 0, width: 780, height: 740 };
    const p = check(editor, desk);
    expect(p.side).toBe("right");
    expect(overlaps(editor, p, 200)).toBe(false);
    const registers = { top: 90, left: 800, width: 640, height: 740 };
    const q = check(registers, desk);
    expect(q.side).toBe("left");
    expect(overlaps(registers, q, 200)).toBe(false);
  });

  it("shrinks into the roomier strip beside a target too short to hold the card", () => {
    const panel = { top: 130, left: 0, width: 390, height: 150 };
    const p = check(panel, { width: 390, height: 440 });
    expect(p.side).toBe("below");
    expect(p.maxHeight).toBe(440 - 8 - (280 + 8));
    expect(overlaps(panel, p, p.maxHeight ?? 0)).toBe(false);
  });

  it("sits whole inside a view that fills a phone, clear of the rows under it", () => {
    // The registers view on a 390x664 phone: the top bar above it, and the
    // status line, run controls and tabs in the 150 px below it. The card
    // leaves 180 px of the view's top showing, where its dec and hex are.
    const view = { width: 390, height: 664 };
    const registers = { top: 44, left: 0, width: 390, height: 470 };
    const p = check(registers, view);
    expect(p.side).toBe("over");
    expect(p.maxHeight).toBeNull();
    expect(p.top).toBe(224);
    expect(p.top + 200).toBeLessThanOrEqual(514);
    expect(p.left).toBe(19);
  });

  it("covers the target only when no side can hold even a short card", () => {
    const everything = { top: 0, left: 0, width: 390, height: 844 };
    const p = check(everything, phone);
    expect(p.side).toBe("over");
  });

  it("narrows to the viewport on a small phone", () => {
    const tab = { top: 596, left: 0, width: 90, height: 44 };
    const p = check(tab, { width: 320, height: 640 });
    expect(p.width).toBe(304);
    expect(p.side).toBe("above");
  });
});

describe("resolveTarget", () => {
  function place(id: string, box: Partial<DOMRect>, style = ""): HTMLElement {
    const el = document.createElement("div");
    el.id = id;
    if (style) el.setAttribute("style", style);
    document.body.appendChild(el);
    const rect = { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, ...box };
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    } as DOMRect);
    return el;
  }

  it("takes the first target on screen and carries its hint", () => {
    place("hidden", { top: 10, left: 10, width: 40, height: 20 }, "visibility: hidden");
    place("empty", { top: 10, left: 10, width: 0, height: 0 });
    const tab = place("tab", { top: 500, left: 10, width: 80, height: 44 });
    const found = resolveTarget([
      { selector: "#missing" },
      { selector: "#hidden" },
      { selector: "#empty" },
      { selector: "#tab", hint: "tap it" },
    ]);
    expect(found?.el).toBe(tab);
    expect(found?.hint).toBe("tap it");
  });

  it("skips a box scrolled wholly out of the viewport", () => {
    place("gone", { top: -300, left: 10, width: 80, height: 44 });
    expect(resolveTarget([{ selector: "#gone" }])).toBeNull();
  });
});

describe("progress", () => {
  it("starts unoffered at the first step", () => {
    expect(loadProgress()).toEqual({ offered: false, step: 0 });
  });

  it("round-trips", () => {
    saveProgress({ offered: true, step: 6 });
    expect(loadProgress()).toEqual({ offered: true, step: 6 });
  });

  it("falls back on a damaged or out-of-range record", () => {
    window.localStorage.setItem(STORE_KEY, "{not json");
    expect(loadProgress()).toEqual({ offered: false, step: 0 });
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ offered: true, step: 99 }));
    expect(loadProgress()).toEqual({ offered: true, step: 0 });
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ offered: "yes", step: 2.5 }));
    expect(loadProgress()).toEqual({ offered: false, step: 0 });
  });

  it("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveProgress({ offered: true, step: 1 })).not.toThrow();
    expect(loadProgress()).toEqual({ offered: false, step: 0 });
  });
});
