import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

/** One place on screen a step can point at. */
export interface WalkthroughTarget {
  selector: string;
  /** Added to the step's text when this target stands in for the part
   *  itself: the tab or menu that leads to it. */
  hint?: string;
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

// On a phone the tools live behind the menu button and most views behind
// the bottom tabs, so those steps point at the way in.
const menu = (what: string): WalkthroughTarget => ({
  selector: anchor("menu"),
  hint: `On a phone, find ${what} in this menu.`,
});
const more = (what: string): WalkthroughTarget => ({
  selector: "#phone-tab-more",
  hint: `On a phone, tap more, then choose ${what}.`,
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
      { selector: "#phone-tab-code", hint: "On a phone, the code tab shows it." },
      { selector: anchor("editor") },
    ],
  },
  {
    id: "files",
    title: "Files",
    body: "A program can span several files. Add one here; every file is joined to main.asm when you assemble, so bl can call a function written in another file.",
    targets: [
      { selector: anchor("files") },
      { selector: "#phone-tab-code", hint: "Tap code to see the files strip above the editor." },
    ],
  },
  {
    id: "assemble",
    title: "Assemble",
    body: "Assemble turns your source into machine code and loads it. A mistake shows up under this row and on the line in the editor that caused it.",
    targets: [{ selector: anchor("assemble") }],
  },
  {
    id: "run",
    title: "Run",
    body: "Run carries the program on until it ends, waits for input, or reaches a breakpoint. While it runs, this button pauses it.",
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
      { selector: anchor("gutter") },
      { selector: "#phone-tab-code", hint: "Tap code to see the line numbers." },
    ],
  },
  {
    id: "registers",
    title: "Registers",
    body: "The registers after each step, with the ones the last instruction changed marked. The x, d, and v buttons switch between the integer, floating-point, and vector registers, and dec and hex change how values are written.",
    // A phone tab only while its view is not already showing: a turned
    // phone shows the registers beside the code, and the card belongs
    // beside them, not on top of them.
    targets: [
      { selector: '#phone-tab-regs[aria-selected="false"]', hint: "On a phone, tap registers to see them." },
      { selector: anchor("registers") },
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
      { selector: '#phone-tab-console[aria-selected="false"]', hint: "On a phone, tap console to see it." },
      { selector: '#phone-panel[aria-labelledby="phone-tab-console"]' },
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

/** Where the offer points: the way back to the walkthrough later. */
export const OFFER_TARGETS: WalkthroughTarget[] = [
  { selector: anchor("tutorials") },
  { selector: anchor("menu") },
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
): { el: Element; hint?: string } | null {
  for (const target of targets) {
    for (const el of root.querySelectorAll(target.selector)) {
      if (isOnScreen(el)) return { el, hint: target.hint };
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
  /** "over" is the last resort: nowhere beside the target has room. */
  side: "below" | "above" | "right" | "left" | "over";
}

const GAP = 8;
const MARGIN = 8;
/** The least a card can shrink to and still show its title, a line of text,
 *  and its buttons. */
const MIN_HEIGHT = 120;
const MIN_WIDTH = 240;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * Put a card of `card` size next to `target` without covering it: below,
 * above, right, then left, whichever has room first. When none has room for
 * the whole card, the roomiest side takes a shorter (scrolling) or narrower
 * card, and only when no side can hold even that does it sit over the target.
 */
export function placeCard(
  target: Box,
  card: { width: number; height: number },
  view: { width: number; height: number },
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
      default:
        return { side, width: w, maxHeight, left: alignedLeft, top: view.height - MARGIN - h };
    }
  };

  if (room.below >= card.height) return at("below", width, card.height, null);
  if (room.above >= card.height) return at("above", width, card.height, null);
  if (room.right >= width && fullHeight >= card.height) return at("right", width, card.height, null);
  if (room.left >= width && fullHeight >= card.height) return at("left", width, card.height, null);

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
  const best = options.sort((a, b) => b.area - a.area)[0];
  if (best) return at(best.side, best.w, best.h, best.h < card.height ? best.h : null);

  const h = Math.min(card.height, fullHeight);
  return at("over", width, h, h < card.height ? h : null);
}
