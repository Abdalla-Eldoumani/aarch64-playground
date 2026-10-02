import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

/** One place on screen a step can point at. */
export interface WalkthroughTarget {
  selector: string;
  /** Added to the step's text when this target stands in for the part
   *  itself: the tab or menu that leads to it. */
  hint?: string;
  /** Controls the card must leave uncovered: a phone's run row sits right
   *  above its tabs, and a view keeps controls in its header. */
  avoid?: string[];
  /** Lay a short card over the bar that holds the target, not beside it:
   *  everything under a phone's top bar is the student's code. */
  overBar?: boolean;
}

export interface WalkthroughStep {
  id: string;
  title: string;
  body: string;
  /** Tried in order; the first one on screen wins. A phone has no debug
   *  column and the desktop has no bottom tabs, so each step lists where the
   *  part lives in every layout. */
  targets: WalkthroughTarget[];
}

const anchor = (name: string) => `[data-walkthrough="${name}"]`;

// A card beside a phone's bottom tabs would sit on the run row above them.
// Back is named too: a narrow card can miss assemble and still cover it.
const RUN_ROW = [anchor("assemble"), 'button[aria-label="back"]'];

// On a phone the tools live behind the menu button and most views behind
// the bottom tabs, so those steps point at the way in.
const menu = (what: string): WalkthroughTarget => ({
  selector: anchor("menu"),
  hint: `On a phone, find ${what} in this menu.`,
  avoid: RUN_ROW,
});
const more = (what: string): WalkthroughTarget => ({
  selector: "#phone-tab-more",
  hint: `On a phone, tap more, then choose ${what}.`,
  avoid: RUN_ROW,
});
const tab = (id: string, name: string): WalkthroughTarget => ({
  selector: `#right-tab-${id}`,
  hint: `Open the ${name} tab to see it.`,
});

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "editor",
    title: "The editor",
    body: "Where you write or paste your program. It is saved as you type, so a reload keeps it.",
    targets: [
      { selector: "#phone-tab-code", hint: "On a phone, the code tab shows it.", avoid: RUN_ROW },
      { selector: anchor("editor") },
    ],
  },
  {
    id: "files",
    title: "Files",
    body: "A program can span several files. Add one here; every file is joined to main.asm when you assemble, so bl can call a function written in another file.",
    targets: [
      { selector: anchor("files"), avoid: RUN_ROW },
      { selector: "#phone-tab-code", hint: "Tap code to see the files strip above the editor.", avoid: RUN_ROW },
    ],
  },
  {
    id: "assemble",
    title: "Assemble",
    body: "Assemble turns your source into machine code and loads it, without running it. A mistake shows up under this row and on the line in the editor that caused it.",
    targets: [{ selector: anchor("assemble") }],
  },
  {
    id: "run",
    title: "Run",
    body: "Run assembles first if nothing is loaded, the program has finished, or you changed the code, files, or arguments. Then it runs until the program ends, waits for input, or reaches a breakpoint. While it runs, this button pauses it.",
    targets: [{ selector: anchor("run") }],
  },
  {
    id: "step",
    title: "Step and continue",
    body: "Step runs one instruction; the highlighted line is the next one to run. Back undoes a step. To carry on from a stop, press run again.",
    targets: [{ selector: anchor("step") }],
  },
  {
    id: "breakpoints",
    title: "Breakpoints",
    body: "Click or tap beside a line number to set a breakpoint, a mark that makes run stop before that line. Do it again to clear it.",
    targets: [
      { selector: `${anchor("editor")} .monaco-editor .margin` },
      { selector: anchor("gutter"), avoid: RUN_ROW },
      { selector: "#phone-tab-code", hint: "Tap code to see the line numbers.", avoid: RUN_ROW },
    ],
  },
  {
    id: "registers",
    title: "Registers",
    body: "The registers after each step, with the ones the last instruction changed marked. Dec and hex change how values are written. Once a program is assembled, the x, d, and v buttons switch between the integer, floating-point, and vector registers.",
    // A phone tab only while its view is not already showing: a turned
    // phone shows the registers beside the code, and the card belongs
    // beside them, not on top of them.
    // Over a phone's registers view the card stays under the dec and hex
    // the text names.
    targets: [
      { selector: '#phone-tab-regs[aria-selected="false"]', hint: "On a phone, tap registers to see them.", avoid: RUN_ROW },
      { selector: anchor("registers"), avoid: [`${anchor("registers")} [aria-label$="value format"]`, ...RUN_ROW] },
    ],
  },
  {
    id: "memory",
    title: "Memory",
    body: "The bytes behind your data, your code, and the stack. Choose a section or type an address to look somewhere else; bytes the last step wrote are marked.",
    targets: [more("memory"), { selector: "#right-panel-memory" }, tab("memory", "memory")],
  },
  {
    id: "console",
    title: "Console and input",
    body: "What the program prints lands here. A program that reads input, with scanf or read, waits at the box below the output until you type a line and press enter.",
    targets: [
      { selector: '#phone-tab-console[aria-selected="false"]', hint: "On a phone, tap console to see it.", avoid: RUN_ROW },
      { selector: '#phone-panel[aria-labelledby="phone-tab-console"]', avoid: RUN_ROW },
      { selector: "#right-panel-console" },
      tab("console", "console"),
    ],
  },
  {
    id: "converter",
    title: "Converter",
    body: "Turns a number between decimal, hex, octal, and binary, shows its two's complement bits, and reads a 32 or 64 bit pattern as an IEEE-754 float.",
    targets: [more("converter"), { selector: "#right-panel-convert" }, tab("convert", "convert")],
  },
  {
    id: "share",
    title: "Share",
    body: "Makes a link that opens this program, with its files and arguments, in anyone's browser. Nothing is uploaded: the program rides inside the link.",
    targets: [{ selector: anchor("share") }, menu("share")],
  },
  {
    id: "export",
    title: "Import and export",
    body: "Import opens a .s, .asm, or .json file from your computer. Export saves the program as a file; workspace .json keeps every file together.",
    targets: [{ selector: anchor("export") }, menu("import and export")],
  },
  {
    id: "diagnostic",
    title: "Diagnostic bundle",
    body: "When a program does something you cannot explain, this packs the program, its input and output, and the machine's registers and memory into one report to paste into a bug report or a question.",
    targets: [{ selector: anchor("diagnostic") }, menu("the diagnostic bundle")],
  },
  {
    id: "commands",
    title: "Command palette",
    body: "Every action in one searchable list. Type part of a name and press enter. Ctrl+K opens it from anywhere.",
    targets: [{ selector: anchor("commands") }, menu("the command palette")],
  },
  {
    id: "help",
    title: "Tutorials and help",
    body: "Tutorials walk through example programs one step at a time, and can start this walkthrough again. With a keyboard, press ? to list every shortcut.",
    targets: [{ selector: anchor("tutorials") }, menu("tutorials")],
  },
];

/** Where the offer points: the way back to the walkthrough later. It keeps
 *  off the code and the registers, which a student opening the playground
 *  from a lesson has come to read. */
export const OFFER_TARGETS: WalkthroughTarget[] = [
  { selector: anchor("tutorials"), avoid: [anchor("editor"), anchor("registers"), ...RUN_ROW] },
  { selector: anchor("menu"), overBar: true },
];

// ---- where the student left off ----

const STORE_KEY = "aarch64-playground:walkthrough";

export interface WalkthroughProgress {
  /** The first-visit offer has been shown, so it is not shown again. */
  offered: boolean;
  /** The step to resume at; back to 0 once the last step is done. */
  step: number;
}

export function loadProgress(): WalkthroughProgress {
  const fallback = { offered: false, step: 0 };
  const raw = safeGetItem(STORE_KEY);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const { offered, step } = parsed as { offered?: unknown; step?: unknown };
    const inRange =
      typeof step === "number" && Number.isInteger(step) && step >= 0 && step < WALKTHROUGH_STEPS.length;
    return { offered: offered === true, step: inRange ? step : 0 };
  } catch {
    return fallback;
  }
}

/** A write that does not land (private mode, a full store) only means the
 *  offer may come back on the next visit. */
export function saveProgress(progress: WalkthroughProgress): void {
  safeSetItem(STORE_KEY, JSON.stringify(progress));
}

// ---- finding the target and placing the card ----

/** On screen: it has a box, it is not `visibility: hidden` (the phone keeps
 *  the editor's box behind another tab), and some of it is in the viewport. */
export function isOnScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (getComputedStyle(el).visibility !== "visible") return false;
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

export function resolveTarget(
  targets: WalkthroughTarget[],
  root: ParentNode = document,
): { el: Element; hint?: string; avoid?: string[]; overBar?: boolean } | null {
  for (const target of targets) {
    for (const el of root.querySelectorAll(target.selector)) {
      if (isOnScreen(el)) return { el, hint: target.hint, avoid: target.avoid, overBar: target.overBar };
    }
  }
  return null;
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  top: number;
  left: number;
  width: number;
  /** Set when the room beside the target is shorter than the card, which
   *  then scrolls instead of covering the target. */
  maxHeight: number | null;
  /** "over" sits inside the target: nowhere beside it has room for the
   *  whole card. */
  side: "below" | "above" | "right" | "left" | "over";
}

const GAP = 8;
const MARGIN = 8;
/** The least a card can shrink to and still show its title, a line of text,
 *  and its buttons. */
const MIN_HEIGHT = 120;
const MIN_WIDTH = 240;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/** A short card over the bar that holds `target`, level with its top and
 *  lined up with its right edge, where a phone keeps its menu button. */
export function placeOverBar(target: Box, cardWidth: number, view: { width: number; height: number }): Placement {
  const width = Math.min(cardWidth, view.width - 2 * MARGIN);
  return {
    side: "over",
    width,
    maxHeight: null,
    top: Math.max(target.top, MARGIN),
    left: clamp(target.left + target.width - width, MARGIN, view.width - MARGIN - width),
  };
}

/**
 * Put a card of `card` size next to `target` without covering it: below,
 * above, right, then left, whichever has room first. When none has room for
 * the whole card, the roomiest side takes a shorter (scrolling) or narrower
 * card, unless that would cut the text and the target is big enough to hold
 * the whole card: then, and when no side can hold even a short card, the card
 * sits over the target, below its header. No placement covers a box in
 * `avoid`: above or below, the card steps past one in its way.
 */
export function placeCard(
  target: Box,
  card: { width: number; height: number },
  view: { width: number; height: number },
  avoid: Box[] = [],
): Placement {
  const width = Math.min(card.width, view.width - 2 * MARGIN);
  const bottom = target.top + target.height;
  const right = target.left + target.width;
  const alignedLeft = clamp(target.left, MARGIN, view.width - MARGIN - width);

  const room = {
    below: view.height - MARGIN - (bottom + GAP),
    above: target.top - GAP - MARGIN,
    right: view.width - MARGIN - (right + GAP),
    left: target.left - GAP - MARGIN,
  };
  const fullHeight = view.height - 2 * MARGIN;
  const sideTop = (height: number) => clamp(target.top, MARGIN, view.height - MARGIN - height);
  // The part of the target on screen, which is where an "over" card goes.
  const shownTop = Math.max(target.top, MARGIN);
  const shownBottom = Math.min(bottom, view.height - MARGIN);

  const hit = (top: number, left: number, w: number, h: number) =>
    avoid.find((a) => a.left < left + w && left < a.left + a.width && a.top < top + h && top < a.top + a.height);
  // Each step lands past the box it hit, so the walk ends within avoid.length steps.
  const stack = (side: "below" | "above", h: number): number => {
    let top = side === "below" ? bottom + GAP : target.top - GAP - h;
    for (let a = hit(top, alignedLeft, width, h); a; a = hit(top, alignedLeft, width, h)) {
      top = side === "below" ? a.top + a.height + GAP : a.top - GAP - h;
    }
    return top;
  };

  // Over the target: its shown part, or with boxes to avoid, the first free
  // stretch of its column from its top that holds the card (else the
  // tallest), which may run past its foot down to the next box.
  const overLeft = clamp(target.left + (target.width - width) / 2, MARGIN, view.width - MARGIN - width);
  const overRegion = (): [number, number] => {
    if (avoid.length === 0) return [shownTop, shownBottom];
    let free: [number, number][] = [[shownTop, view.height - MARGIN]];
    for (const a of avoid) {
      if (a.left >= overLeft + width || overLeft >= a.left + a.width) continue;
      free = free
        .flatMap(([t, b]): [number, number][] => [
          [t, Math.min(b, a.top - GAP)],
          [Math.max(t, a.top + a.height + GAP), b],
        ])
        .filter(([t, b]) => b > t);
    }
    free = free.filter(([t]) => t < shownBottom);
    return (
      free.find(([t, b]) => b - t >= card.height) ??
      free.sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0] ?? [shownTop, shownBottom]
    );
  };
  const [regionTop, regionBottom] = overRegion();

  const at = (side: Placement["side"], w: number, h: number, maxHeight: number | null): Placement => {
    switch (side) {
      case "below":
        return { side, width: w, maxHeight, left: alignedLeft, top: bottom + GAP };
      case "above":
        return { side, width: w, maxHeight, left: alignedLeft, top: target.top - GAP - h };
      case "right":
        return { side, width: w, maxHeight, left: right + GAP, top: sideTop(h) };
      case "left":
        return { side, width: w, maxHeight, left: target.left - GAP - w, top: sideTop(h) };
      default: {
        // A view keeps its controls in a header (dec and hex) and sometimes
        // a row at its foot (the console's input box), so the card leaves
        // twice as much of the view above it as below. A fixed guess unless
        // the target names its controls in `avoid`.
        const spare = regionBottom - regionTop - h;
        const top = regionTop + (spare > 0 ? (spare * 2) / 3 : spare / 2);
        return { side, width: w, maxHeight, left: overLeft, top: clamp(top, MARGIN, view.height - MARGIN - h) };
      }
    }
  };

  const belowTop = stack("below", card.height);
  if (belowTop + card.height <= view.height - MARGIN) {
    return { side: "below", width, maxHeight: null, left: alignedLeft, top: belowTop };
  }
  const aboveTop = stack("above", card.height);
  if (aboveTop >= MARGIN) return { side: "above", width, maxHeight: null, left: alignedLeft, top: aboveTop };
  // Beside the target, rising past a box in the way: the controls to avoid
  // sit at the foot of a turned phone's column.
  const fullSide = (side: "right" | "left") => {
    if (room[side] < width || fullHeight < card.height) return null;
    const p = at(side, width, card.height, null);
    for (let a = hit(p.top, p.left, width, card.height); a; a = hit(p.top, p.left, width, card.height)) {
      p.top = a.top - GAP - card.height;
    }
    return p.top >= MARGIN ? p : null;
  };
  const sideways = fullSide("right") ?? fullSide("left");
  if (sideways) return sideways;

  // Nothing holds the whole card: the side with the most usable area takes
  // a shrunk one.
  const options: { side: Placement["side"]; area: number; w: number; h: number }[] = [];
  for (const side of ["below", "above"] as const) {
    const h = Math.min(card.height, room[side]);
    if (h >= MIN_HEIGHT) options.push({ side, area: width * h, w: width, h });
  }
  for (const side of ["right", "left"] as const) {
    const w = Math.min(width, room[side]);
    const h = Math.min(card.height, fullHeight);
    if (w >= MIN_WIDTH && h >= MIN_HEIGHT) options.push({ side, area: w * h, w, h });
  }
  const best = options
    .filter((o) => {
      const p = at(o.side, o.w, o.h, null);
      return !hit(p.top, p.left, o.w, o.h);
    })
    .sort((a, b) => b.area - a.area)[0];
  // A phone's registers or console view fills the screen but for a strip,
  // and a card cut to that strip shows its title and one line. Covering part
  // of such a view is the smaller loss.
  const holdsCard =
    (avoid.length ? regionBottom - regionTop : shownBottom - shownTop - 2 * GAP) >= card.height &&
    target.width >= width;
  if (best && (best.h === card.height || !holdsCard)) {
    return at(best.side, best.w, best.h, best.h < card.height ? best.h : null);
  }

  const h = Math.min(card.height, avoid.length ? regionBottom - regionTop : fullHeight);
  return at("over", width, h, h < card.height ? h : null);
}
