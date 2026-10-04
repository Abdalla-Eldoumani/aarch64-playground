// The editor and terminal palettes built from each theme's tokens: Monaco
// takes a token for every colour it registers, the text and marks every
// widget a student can open read on what they sit on, and every terminal
// colour a program prints in reads on the terminal and is the hue its ANSI
// name promises.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { THEMES } from "@/lib/theme/themes";
import { monacoTheme, xtermTheme } from "@/lib/theme/editor-themes";
import { THEME_TOKENS } from "@/lib/theme/tokens";
import { contrast, oklchHue, over } from "@/lib/test/content/helpers/contrast";

function shortfalls(pairs: [string, string, string][], bar: number): string[] {
  return pairs
    .map(([name, fg, bg]) => [name, contrast(fg, bg)] as const)
    .filter(([, ratio]) => ratio < bar)
    .map(([name, ratio]) => `${name}: ${ratio.toFixed(2)}`);
}

// Every colour id the installed monaco-editor registers, read from its
// source, so an upgrade that adds one fails here until the theme places it.
function registeredColourIds(): string[] {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (name.endsWith(".js")) {
        const text = readFileSync(file, "utf8");
        for (const m of text.matchAll(/registerColor\(\s*['"]([\w.]+)['"]/g)) ids.add(m[1]);
      }
    }
  };
  walk(path.join(process.cwd(), "node_modules/monaco-editor/esm"));
  return [...ids].sort();
}

const COLOUR_IDS = registeredColourIds();
const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

describe("the colour ids Monaco registers", () => {
  it("are read from the installed package", () => {
    expect(COLOUR_IDS.length).toBeGreaterThan(400);
    expect(COLOUR_IDS).toEqual(
      expect.arrayContaining(["editor.background", "editorWarning.foreground", "list.highlightForeground"]),
    );
  });
});

// OKLCH hue windows for the six named ANSI colours. Yellow reaches down to
// brown, which is what the dark ANSI yellow has long been on light screens.
// Blue reaches up to sky blue, the keyword colour high contrast has always
// lent its terminal.
const HUES: Record<string, [number, number]> = {
  red: [5, 40],
  yellow: [60, 110],
  green: [120, 165],
  cyan: [165, 235],
  blue: [220, 275],
  magenta: [290, 350],
};

for (const { id, kind } of THEMES) {
  const bar = id === "high-contrast" ? 7 : 4.5;

  describe(`${id} editor theme`, () => {
    const theme = monacoTheme(id, COLOUR_IDS);
    const c = theme.colors;
    const bg = c["editor.background"];
    const caretLine = over(c["editor.lineHighlightBackground"], bg);

    it("sits on the page colour and uses the base for its kind", () => {
      expect(bg).toBe(THEME_TOKENS[id]["bg-base"]);
      expect(theme.base).toBe(id === "high-contrast" ? "hc-black" : kind === "light" ? "vs" : "vs-dark");
    });

    // Monaco draws any colour a theme leaves out in its stock grey, blue or
    // gold, which none of the pairs below would see.
    it("sets every colour Monaco registers, and only those", () => {
      expect(COLOUR_IDS.filter((colourId) => !HEX.test(c[colourId] ?? ""))).toEqual([]);
      expect(Object.keys(c).filter((key) => !COLOUR_IDS.includes(key))).toEqual([]);
    });

    it(`the code, and every mark laid over it, reads at ${bar}:1`, () => {
      // Where code sits: the page, the caret line, a selection (also on the
      // caret line), the pc line, and the fainter fill that echoes the word
      // or bracket under the caret elsewhere.
      const under: [string, string][] = [
        ["background", bg],
        ["caret line", caretLine],
        ["selection", over(c["editor.selectionBackground"], bg)],
        ["selection on the caret line", over(c["editor.selectionBackground"], caretLine)],
        ["pc line", over(THEME_TOKENS[id].amber, bg, 0.15)],
        ["echo", over(c["editor.wordHighlightTextBackground"], bg)],
        ["echo on the caret line", over(c["editor.wordHighlightTextBackground"], caretLine)],
      ];
      const inks: [string, string][] = [
        ...theme.rules.map((rule): [string, string] => [rule.token, `#${rule.foreground}`]),
        ["plain text", c["editor.foreground"]],
        ["bracket", c["editorBracketHighlight.foreground1"]],
        ["matched bracket", c["editorBracketMatch.foreground"]],
      ];
      const pairs: [string, string, string][] = [];
      for (const [ink, fg] of inks) {
        for (const [name, surface] of under) pairs.push([`${ink} on ${name}`, fg, surface]);
      }
      pairs.push(
        ["line number", c["editorLineNumber.foreground"], bg],
        ["caret line's number", c["editorLineNumber.activeForeground"], caretLine],
        ["placeholder", c["editor.placeholder.foreground"], bg],
        ["current find match", c["editor.findMatchForeground"], over(c["editor.findMatchBackground"], bg)],
        ["other find matches", c["editor.findMatchHighlightForeground"], over(c["editor.findMatchHighlightBackground"], bg)],
        ["character under the block caret", c["editorCursor.background"], c["editorCursor.foreground"]],
      );
      expect(shortfalls(pairs, bar)).toEqual([]);
    });

    // The lint marks: the default program shows a warning on first load.
    it("the squiggles, the caret and the gutter marks stand out at 3:1", () => {
      const pairs: [string, string, string][] = [];
      for (const key of ["editorError.foreground", "editorWarning.foreground", "editorInfo.foreground", "editorHint.foreground"]) {
        pairs.push([`${key} on background`, c[key], bg], [`${key} on the caret line`, c[key], caretLine]);
      }
      pairs.push(
        ["caret", c["editorCursor.foreground"], bg],
        ["caret on the caret line", c["editorCursor.foreground"], caretLine],
        ["folding control", c["editorGutter.foldingControlForeground"], bg],
        ["matched bracket edge", c["editorBracketMatch.border"], bg],
        ["current match edge", c["editor.findMatchBorder"], bg],
        ["other match edge", c["editor.findMatchHighlightBorder"], bg],
        ["unicode edge", c["editorUnicodeHighlight.border"], bg],
      );
      for (const severity of ["Error", "Warning", "Info"]) {
        pairs.push([`${severity} problem frame`, c[`editorMarkerNavigation${severity}.background`], bg]);
      }
      expect(shortfalls(pairs, 3)).toEqual([]);
    });

    // Monaco paints selected text in editor.selectionForeground unless that
    // is transparent; then selected text keeps the token colours checked above.
    it(`selected text reads on the selection at ${bar}:1`, () => {
      const ink = c["editor.selectionForeground"];
      if (ink.length === 9 && ink.endsWith("00")) return;
      const selection = over(c["editor.selectionBackground"], bg);
      expect(shortfalls([["selected text", ink, selection]], bar)).toEqual([]);
    });

    // Every widget a student can open, with each text it draws on each fill
    // under it: a plain, a hovered and a chosen row where it has rows.
    it(`the find box, hover card, suggestions, menu, command list and problem view read at ${bar}:1`, () => {
      const widget = c["editorWidget.background"];
      const card = c["editorHoverWidget.background"];
      const suggest = c["editorSuggestWidget.background"];
      const quick = c["quickInput.background"];
      const hovered = c["list.hoverBackground"];
      const pairs: [string, string, string][] = [
        ["find box text", c["editorWidget.foreground"], widget],
        ["find box note", c.descriptionForeground, widget],
        ["find no results", c.errorForeground, widget],
        ["find field text", c["input.foreground"], c["input.background"]],
        ["find field placeholder", c["input.placeholderForeground"], c["input.background"]],
        ["find field selected text", c["input.foreground"], over(c["selection.background"], c["input.background"])],
        ["find toggle on", c["inputOption.activeForeground"], c["inputOption.activeBackground"]],
        ["find regex error", c["inputValidation.errorForeground"], c["inputValidation.errorBackground"]],
        ["hover text", c["editorHoverWidget.foreground"], card],
        ["hover link", c["textLink.foreground"], card],
        ["hover matched text", c["editorHoverWidget.highlightForeground"], card],
        ["hover note", c.descriptionForeground, card],
        ["hover inline code", c["textPreformat.foreground"], over(c["textPreformat.background"], card)],
        ["hover code block", c["editor.foreground"], over(c["textCodeBlock.background"], card)],
        ["hover quote", c["editorHoverWidget.foreground"], c["textBlockQuote.background"]],
        ["hover status bar", c["editorHoverWidget.foreground"], c["editorHoverWidget.statusBarBackground"]],
        ["hover status bar link", c["textLink.foreground"], c["editorHoverWidget.statusBarBackground"]],
        ["suggestion", c["editorSuggestWidget.foreground"], suggest],
        ["matched letters", c["editorSuggestWidget.highlightForeground"], suggest],
        ["suggestion detail", c.descriptionForeground, suggest],
        ["suggestion status", c["editorSuggestWidgetStatus.foreground"], suggest],
        ["hovered suggestion", c["list.hoverForeground"], hovered],
        ["matched letters on a hovered row", c["editorSuggestWidget.highlightForeground"], hovered],
        ["detail on a hovered row", c.descriptionForeground, hovered],
        ["chosen suggestion", c["editorSuggestWidget.selectedForeground"], c["editorSuggestWidget.selectedBackground"]],
        ["chosen matched letters", c["editorSuggestWidget.focusHighlightForeground"], c["editorSuggestWidget.selectedBackground"]],
        ["menu item", c["menu.foreground"], c["menu.background"]],
        ["chosen menu item", c["menu.selectionForeground"], c["menu.selectionBackground"]],
        ["command", c["quickInput.foreground"], quick],
        ["command title bar", c["quickInput.foreground"], over(c["quickInputTitle.background"], quick)],
        ["command matched letters", c["list.highlightForeground"], quick],
        ["command group", c["pickerGroup.foreground"], quick],
        ["command note", c.descriptionForeground, quick],
        ["hovered command", c["list.hoverForeground"], hovered],
        ["command matched letters on a hovered row", c["list.highlightForeground"], hovered],
        ["chosen command", c["quickInputList.focusForeground"], c["quickInputList.focusBackground"]],
        ["chosen command's matched letters", c["quickInputList.focusHighlightForeground"], c["quickInputList.focusBackground"]],
        ["selected list row", c["list.activeSelectionForeground"], c["list.activeSelectionBackground"]],
        ["selected list row's matched letters", c["list.focusHighlightForeground"], c["list.activeSelectionBackground"]],
        ["inactive selected row", c["list.inactiveSelectionForeground"], c["list.inactiveSelectionBackground"]],
        ["keyboard chip", c["keybindingLabel.foreground"], c["keybindingLabel.background"]],
        ["command filter text", c["input.foreground"], c["input.background"]],
        ["problem message", c["editor.foreground"], c["editorMarkerNavigation.background"]],
      ];
      for (const severity of ["Error", "Warning", "Info"]) {
        const header = c[`editorMarkerNavigation${severity}.headerBackground`];
        pairs.push(
          [`${severity} problem title`, c["peekViewTitleLabel.foreground"], header],
          [`${severity} problem count`, c["peekViewTitleDescription.foreground"], header],
        );
      }
      expect(shortfalls(pairs, bar)).toEqual([]);
    });

    // Text on a chosen row reading well says nothing if the row's fill is the
    // widget's own: then no row looks chosen.
    it("a hovered and a chosen row each have a fill of their own", () => {
      const rows: [string, string, string, string][] = [
        ["suggestion", c["editorSuggestWidget.background"], c["list.hoverBackground"], c["editorSuggestWidget.selectedBackground"]],
        ["menu item", c["menu.background"], c["list.hoverBackground"], c["menu.selectionBackground"]],
        ["command", c["quickInput.background"], c["list.hoverBackground"], c["quickInputList.focusBackground"]],
        ["selected list row", c["quickInput.background"], c["list.hoverBackground"], c["list.activeSelectionBackground"]],
        ["find toggle", c["input.background"], c["inputOption.hoverBackground"], c["inputOption.activeBackground"]],
        ["find button", c["editorWidget.background"], c["toolbar.hoverBackground"], c["toolbar.activeBackground"]],
      ];
      const same = rows.filter(([, plain, hovered, chosen]) => new Set([plain, hovered, chosen]).size < 3);
      expect(same.map(([name]) => name)).toEqual([]);
    });

    it("the widgets' edges, icons and disabled buttons stand out at 3:1", () => {
      const widget = c["editorWidget.background"];
      const suggest = c["editorSuggestWidget.background"];
      const hovered = c["list.hoverBackground"];
      const pairs: [string, string, string][] = [
        ["find field edge", c["input.border"], widget],
        ["find toggle edge", c["inputOption.activeBorder"], widget],
        ["focus ring", c.focusBorder, c["input.background"]],
        ["widget icon", c["icon.foreground"], widget],
        ["icon on a hovered button", c["icon.foreground"], c["toolbar.hoverBackground"]],
        ["icon on a pressed button", c["icon.foreground"], c["toolbar.activeBackground"]],
        ["icon on a hovered toggle", c["icon.foreground"], c["inputOption.hoverBackground"]],
        ["disabled arrow", c.disabledForeground, widget],
        ["chosen suggestion's icon", c["editorSuggestWidget.selectedIconForeground"], c["editorSuggestWidget.selectedBackground"]],
        ["chosen command's icon", c["quickInputList.focusIconForeground"], c["quickInputList.focusBackground"]],
        ["progress bar", c["progressBar.background"], c["quickInput.background"]],
      ];
      // The icons the editor's completions use: instruction, register,
      // directive, label.
      for (const icon of ["function", "variable", "keyword", "reference"]) {
        const key = `symbolIcon.${icon}Foreground`;
        pairs.push([`${icon} icon`, c[key], suggest], [`${icon} icon on a hovered row`, c[key], hovered]);
      }
      for (const severity of ["Error", "Warning", "Info"]) {
        pairs.push([`${severity} icon in the hover card`, c[`problems${severity}Icon.foreground`], c["editorHoverWidget.background"]]);
      }
      expect(shortfalls(pairs, 3)).toEqual([]);
    });
  });

  describe(`${id} terminal palette`, () => {
    const palette = xtermTheme(id);
    const background = palette.background ?? "";
    // The one slot programs use as a background colour: black on a dark
    // terminal, white on a light one. It is a surface, not an ink.
    const backgroundSlot = kind === "light" ? "white" : "black";

    it(`the text and every ANSI ink read on the terminal at ${bar}:1`, () => {
      const inks = [
        "foreground",
        "black",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
        "cyan",
        "white",
        "brightBlack",
        "brightRed",
        "brightGreen",
        "brightYellow",
        "brightBlue",
        "brightMagenta",
        "brightCyan",
        "brightWhite",
      ] as const;
      const pairs = inks
        .filter((ink) => ink !== backgroundSlot)
        .map((ink): [string, string, string] => [ink, palette[ink] ?? "", background]);
      pairs.push(["text under the block cursor", palette.cursorAccent ?? "", palette.cursor ?? ""]);
      pairs.push(["foreground on the selection", palette.foreground ?? "", over(palette.selectionBackground ?? "", background)]);
      expect(shortfalls(pairs, bar)).toEqual([]);
    });

    it("each named colour is the hue its name promises", () => {
      const off: string[] = [];
      for (const [name, [lo, hi]] of Object.entries(HUES)) {
        const hex = palette[name as keyof typeof palette] as string;
        const hue = oklchHue(hex);
        if (hue < lo || hue > hi) off.push(`${name} ${hex} at ${Math.round(hue)}`);
      }
      expect(off).toEqual([]);
    });
  });
}
