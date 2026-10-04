// Pins the interface walkthrough's data and geometry: the steps cover every
// part the walkthrough promises, a card is placed beside its target without
// covering it whenever the screen has room, the first on-screen target wins,
// and a broken store never breaks the page.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OFFER_TARGETS,
  WALKTHROUGH_STEPS,
  loadProgress,
  placeCard,
  placeOverBar,
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

  it("says when run assembles first, and that assemble alone does not run", () => {
    const body = (id: string) => WALKTHROUGH_STEPS.find((s) => s.id === id)?.body ?? "";
    expect(body("assemble")).toContain("loads it, without running it");
    expect(body("run")).toContain(
      "Run assembles first if nothing is loaded, the program has finished, or you changed the code, files, or arguments.",
    );
  });

  it("keeps every card a phone shows off the run row, its back button included", () => {
    const runRowSteps = ["assemble", "run", "step"];
    const phoneOnly = /^#phone-|"menu"|"gutter"|"files"/;
    for (const step of WALKTHROUGH_STEPS) {
      if (runRowSteps.includes(step.id)) continue;
      for (const t of step.targets) {
        if (!phoneOnly.test(t.selector)) continue;
        expect(t.avoid, `${step.id} ${t.selector}`).toContain('[data-walkthrough="assemble"]');
        expect(t.avoid, `${step.id} ${t.selector}`).toContain('button[aria-label="back"]');
      }
    }
  });
});

describe("the offer", () => {
  it("keeps off the code and the registers, and goes over a phone's bar", () => {
    const [tutorials, menu] = OFFER_TARGETS;
    expect(tutorials.avoid).toEqual(
      expect.arrayContaining(['[data-walkthrough="editor"]', '[data-walkthrough="registers"]']),
    );
    expect(menu.selector).toBe('[data-walkthrough="menu"]');
    expect(menu.overBar).toBe(true);
  });

  it("drops under the registers at 1920x1080, over the tabs below them", () => {
    // Measured on /playground at 1920x1080: the tutorials button in the
    // band, the register pane top right, the editor on the left.
    const tutorialsBox = { top: 47, left: 1535, width: 70, height: 40 };
    const registers = { top: 120, left: 1060, width: 860, height: 500 };
    const editor = { top: 150, left: 0, width: 1055, height: 595 };
    const p = placeCard(tutorialsBox, { width: 352, height: 190 }, { width: 1920, height: 1080 }, [editor, registers]);
    expect(p.side).toBe("below");
    expect(p.top).toBe(620 + 8);
    expect(overlaps(registers, p, 190)).toBe(false);
    expect(overlaps(editor, p, 190)).toBe(false);
  });

  it("sits level with a phone's menu row, at its right edge, inside the screen", () => {
    const view13 = { width: 390, height: 664 };
    const menu13 = { top: 0, left: 338, width: 52, height: 44 };
    expect(placeOverBar(menu13, 352, view13)).toEqual({ side: "over", width: 352, maxHeight: null, top: 8, left: 30 });
    const se = { width: 320, height: 568 };
    const menuSe = { top: 0, left: 268, width: 52, height: 44 };
    expect(placeOverBar(menuSe, 352, se)).toEqual({ side: "over", width: 304, maxHeight: null, top: 8, left: 8 });
    // An installed app's bar starts below the status bar; the card follows it.
    expect(placeOverBar({ ...menu13, top: 47 }, 352, view13).top).toBe(47);
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

  // The boxes below were measured on the 320x568 iPhone SE.
  const se = { width: 320, height: 568 };
  const assemble = { top: 475, left: 8, width: 71, height: 44 };

  it("keeps a card beside a phone's tabs off the run row above them", () => {
    const more = { top: 523, left: 240, width: 80, height: 45 };
    const p = placeCard(more, { width: 352, height: 212 }, se, [assemble]);
    expect(p.side).toBe("above");
    expect(p.top).toBe(475 - 8 - 212);
    expect(overlaps(assemble, p, 212)).toBe(false);
    // Without the run row to avoid, the card sat on it.
    expect(overlaps(assemble, placeCard(more, { width: 352, height: 212 }, se), 212)).toBe(true);
  });

  it("sits over a phone's registers view under its dec and hex, clear of the run row", () => {
    const registers = { top: 45, left: 0, width: 320, height: 385 };
    const decHex = { top: 142, left: 8, width: 90, height: 46 };
    const p = placeCard(registers, { width: 352, height: 255 }, se, [decHex, assemble]);
    expect(p.side).toBe("over");
    expect(p.maxHeight).toBeNull();
    expect(overlaps(decHex, p, 255)).toBe(false);
    expect(overlaps(assemble, p, 255)).toBe(false);
    expect(p.top + 255).toBeLessThanOrEqual(568 - 8);
  });

  it("scrolls a card that no free stretch of the view can hold", () => {
    const registers = { top: 45, left: 0, width: 320, height: 385 };
    const header = { top: 100, left: 8, width: 300, height: 200 };
    const p = placeCard(registers, { width: 352, height: 255 }, se, [header, assemble]);
    expect(p.side).toBe("over");
    expect(p.top).toBe(308);
    expect(p.maxHeight).toBe(475 - 8 - 308);
  });

  it("lifts a card beside a turned phone's registers clear of the run row", () => {
    // iPhone 13 on its side: the registers sit right, the run row at the
    // foot of the editor on the left.
    const view = { width: 750, height: 342 };
    const registers = { top: 90, left: 412, width: 330, height: 208 };
    const runRow = { top: 298, left: 8, width: 90, height: 44 };
    const decHex = { top: 120, left: 420, width: 90, height: 44 };
    const p = placeCard(registers, { width: 352, height: 243 }, view, [decHex, runRow]);
    expect(p.side).toBe("left");
    expect(p.top).toBe(298 - 8 - 243);
    expect(p.maxHeight).toBeNull();
    expect(overlaps(runRow, p, 243)).toBe(false);
  });

  it("puts the offer under a phone's menu past the files strip", () => {
    const menu = { top: 0, left: 268, width: 52, height: 44 };
    const files = { top: 45, left: 0, width: 320, height: 53 };
    const p = placeCard(menu, { width: 352, height: 212 }, se, [files]);
    expect(p.side).toBe("below");
    expect(p.top).toBe(98 + 8);
  });

  it("keeps the editor's card off the run row in a short window", () => {
    // Measured at 1366x657: the editor over the disassembly, the run row
    // under both, and room for the card between the editor and the row.
    const view = { width: 1366, height: 657 };
    const editor = { top: 119, left: 0, width: 750, height: 351 };
    const runRow = [
      { top: 609, left: 16, width: 94, height: 44 },
      { top: 609, left: 249, width: 65, height: 44 },
    ];
    const size = { width: 352, height: 141 };
    expect(runRow.some((b) => overlaps(b, placeCard(editor, size, view), 141))).toBe(true);
    const p = placeCard(editor, size, view, runRow);
    expect(runRow.some((b) => overlaps(b, p, 141))).toBe(false);
    expect(p.side).toBe("right");
    const editorStep = WALKTHROUGH_STEPS.find((st) => st.id === "editor");
    const desk = editorStep?.targets.find((t) => t.selector === '[data-walkthrough="editor"]');
    expect(desk?.avoid).toContain('button[aria-label="back"]');
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
