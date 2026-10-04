import type { ITheme } from "@xterm/xterm";
import { themeInfo, type ThemeId } from "@/lib/theme/themes";
import { ANSI_SOURCES, THEME_TOKENS } from "@/lib/theme/tokens";

/** Monaco's theme shape (IStandaloneThemeData), restated so this module stays free of the editor. */
export interface MonacoThemeData {
  base: "vs" | "vs-dark" | "hc-black";
  inherit: boolean;
  rules: { token: string; foreground: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

/** `a` moved `amount` of the way to `b` in sRGB, as CSS color-mix(in srgb) does. */
function mix(a: string, b: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount);
    out += v.toString(16).padStart(2, "0").toUpperCase();
  }
  return out;
}

/**
 * The editor theme for one site theme; monaco-setup.ts registers it as `arm64-<id>`.
 *
 * `colourIds` is every colour Monaco can draw: its colour registry in the
 * browser, the installed package's source in the tests. Monaco paints any id a
 * theme leaves out in its own stock grey, blue or gold, which no theme test
 * measures, so every id takes a token here: the named ones below, the rest by
 * the kind of thing their name says they paint. There is no fallback: an id
 * no rule places is left out, and the editor-theme test names it.
 */
export function monacoTheme(id: ThemeId, colourIds: readonly string[]): MonacoThemeData {
  const t = THEME_TOKENS[id];
  const light = themeInfo(id).kind === "light";
  const hc = id === "high-contrast";
  // Token rules take RRGGBB without the hash.
  const ink = (hex: string) => hex.slice(1, 7);
  const clear = `${t["bg-base"]}00`;
  // Monaco's extra outlines, drawn only in high contrast as its own hc themes do.
  const edge = hc ? t["border-control"] : clear;
  const activeEdge = hc ? t.focus : clear;
  // The caret's line: a step off the page, lighter on dark and darker on light.
  const caretLine = light ? `${t["bg-sunken"]}CC` : `${t["bg-raised"]}AA`;
  // Every widget sits on bg-elevated. A hovered row or button steps toward
  // the page, away from every ink, so what reads on the widget reads on it.
  const hover = t["bg-panel"];
  // The chosen row of a list or menu.
  const chosen = t["cyan-dim"];
  // Other places the word or match under the caret appears: the selection's
  // hue, fainter than the selection.
  const echo = `${t.cyan}1A`;
  const shadow = hc ? clear : light ? `${t["text-primary"]}29` : `${t["bg-base"]}B3`;

  const named: Record<string, string> = {
    // The page under the code.
    foreground: t["text-primary"],
    "editor.background": t["bg-base"],
    "editor.foreground": t["text-primary"],
    "editorGutter.background": t["bg-base"],
    "editorOverviewRuler.background": t["bg-base"],
    "editorStickyScroll.background": t["bg-base"],
    "editorStickyScrollGutter.background": t["bg-base"],
    "editorStickyScrollHover.background": caretLine,
    "editorMarkerNavigation.background": t["bg-base"],
    "breadcrumb.background": t["bg-base"],
    "minimap.background": t["bg-base"],
    "scrollbar.background": clear,
    "editor.lineHighlightBackground": caretLine,
    "editor.inactiveLineHighlightBackground": caretLine,
    // Monaco boxes the caret line whenever a theme names this colour.
    "editor.lineHighlightBorder": clear,
    "editor.selectionBackground": t.selection,
    "editor.inactiveSelectionBackground": t.selection,
    "selection.background": t.selection,
    // Monaco skips a transparent one, so selected text keeps its token colours.
    // An hc-black base would paint it black, made for its white selection.
    "editor.selectionForeground": hc ? t["text-primary"] : clear,
    "editorLineNumber.foreground": t["text-tertiary"],
    "editorLineNumber.activeForeground": t["text-secondary"],
    "editorActiveLineNumber.foreground": t["text-secondary"],
    "editorLineNumber.dimmedForeground": t["text-tertiary"],
    // The caret is the machine's block cursor.
    "editorCursor.foreground": t.amber,
    "editorCursor.background": t["bg-base"],
    "editorMultiCursor.primary.foreground": t.amber,
    "editorMultiCursor.primary.background": t["bg-base"],
    "editorMultiCursor.secondary.foreground": t.amber,
    "editorMultiCursor.secondary.background": t["bg-base"],
    "editor.compositionBorder": t["text-primary"],
    "editorWhitespace.foreground": t["border-strong"],
    "editorRuler.foreground": t.border,
    "editorGutter.foldingControlForeground": t["text-secondary"],
    "editor.foldPlaceholderForeground": t["text-tertiary"],
    "editor.placeholder.foreground": t["text-tertiary"],
    "editorGhostText.foreground": t["text-tertiary"],
    "editorGhostText.background": clear,
    "editorCodeLens.foreground": t["text-secondary"],
    "editorLink.activeForeground": t.cyan,
    // Brackets are plain text in assembly; a matched pair is echoed and boxed.
    "editorBracketHighlight.unexpectedBracket.foreground": t.danger,
    "editorBracketMatch.foreground": t["text-primary"],
    "editorBracketMatch.background": echo,
    "editorBracketMatch.border": t["border-control"],
    // Only the alpha of these counts: code is never faded.
    "editorUnnecessaryCode.opacity": `${t["text-primary"]}FF`,
    "minimap.foregroundOpacity": `${t["text-primary"]}FF`,

    // Lint marks: the role colours, so a warning reads as a warning in every
    // theme. The fills stay clear so the code under them keeps its contrast.
    "editorError.foreground": t.danger,
    "editorWarning.foreground": t.warning,
    "editorInfo.foreground": t.cyan,
    "editorHint.foreground": t["text-tertiary"],
    "editorError.background": clear,
    "editorWarning.background": clear,
    "editorInfo.background": clear,
    "editorError.border": hc ? t.danger : clear,
    "editorWarning.border": hc ? t.warning : clear,
    "editorInfo.border": hc ? t.cyan : clear,
    "editorHint.border": edge,
    "editorUnicodeHighlight.background": clear,
    "editorUnicodeHighlight.border": t.warning,
    "problemsErrorIcon.foreground": t.danger,
    "problemsWarningIcon.foreground": t.warning,
    "problemsInfoIcon.foreground": t.cyan,
    "editorMarkerNavigationError.background": t.danger,
    "editorMarkerNavigationWarning.background": t.warning,
    "editorMarkerNavigationInfo.background": t.cyan,
    "editorMarkerNavigationError.headerBackground": t["bg-elevated"],
    "editorMarkerNavigationWarning.headerBackground": t["bg-elevated"],
    "editorMarkerNavigationInfo.headerBackground": t["bg-elevated"],
    "editorLightBulb.foreground": t.warning,
    "editorLightBulbAutoFix.foreground": t.cyan,
    "editorLightBulbAi.foreground": t.cyan,

    // The match the find box is on is selected, so it takes the selection
    // fill; the other matches are outlined and keep the page under the code.
    // A named ink replaces the token colours, so both are primary text.
    "editor.findMatchBackground": t.selection,
    "editor.findMatchForeground": t["text-primary"],
    "editor.findMatchBorder": t.cyan,
    "editor.findMatchHighlightBackground": clear,
    "editor.findMatchHighlightForeground": t["text-primary"],
    "editor.findMatchHighlightBorder": t["border-control"],
    "editor.findRangeHighlightBackground": echo,
    "editor.findRangeHighlightBorder": activeEdge,
    "editor.wordHighlightBackground": echo,
    "editor.wordHighlightStrongBackground": echo,
    "editor.wordHighlightTextBackground": echo,
    "editor.selectionHighlightBackground": echo,
    "editor.symbolHighlightBackground": echo,
    "editor.hoverHighlightBackground": echo,
    "editor.rangeHighlightBackground": echo,
    "editor.linkedEditingBackground": echo,
    "editor.snippetTabstopHighlightBackground": echo,
    "editor.snippetFinalTabstopHighlightBackground": clear,
    "editor.foldBackground": echo,
    "editor.wordHighlightBorder": activeEdge,
    "editor.wordHighlightStrongBorder": activeEdge,
    "editor.wordHighlightTextBorder": activeEdge,
    "editor.selectionHighlightBorder": activeEdge,
    "editor.symbolHighlightBorder": activeEdge,
    "editor.rangeHighlightBorder": activeEdge,
    "editor.snippetTabstopHighlightBorder": activeEdge,
    "editor.snippetFinalTabstopHighlightBorder": t["border-control"],

    // The overview ruler at the editor's right edge: the same marks, as ticks.
    "editorOverviewRuler.border": t.border,
    "editorOverviewRuler.errorForeground": t.danger,
    "editorOverviewRuler.warningForeground": t.warning,
    "editorOverviewRuler.infoForeground": t.cyan,
    "editorOverviewRuler.findMatchForeground": t.cyan,
    "editorOverviewRuler.rangeHighlightForeground": t["text-tertiary"],
    "editorOverviewRuler.selectionHighlightForeground": t["text-tertiary"],
    "editorOverviewRuler.wordHighlightForeground": t["text-tertiary"],
    "editorOverviewRuler.wordHighlightStrongForeground": t["text-tertiary"],
    "editorOverviewRuler.wordHighlightTextForeground": t["text-tertiary"],
    "editorOverviewRuler.bracketMatchForeground": t["text-tertiary"],
    "minimap.errorHighlight": t.danger,
    "minimap.warningHighlight": t.warning,
    "minimap.infoHighlight": t.cyan,
    "minimap.findMatchHighlight": t.cyan,
    "minimap.selectionHighlight": t.selection,
    "minimap.selectionOccurrenceHighlight": echo,
    // Scroll thumbs as the page's own, see-through so code under them shows.
    "scrollbarSlider.background": `${t["border-strong"]}99`,
    "scrollbarSlider.hoverBackground": `${t["border-control"]}99`,
    "scrollbarSlider.activeBackground": `${t["border-control"]}CC`,
    "minimapSlider.background": `${t["border-strong"]}66`,
    "minimapSlider.hoverBackground": `${t["border-control"]}66`,
    "minimapSlider.activeBackground": `${t["border-control"]}99`,

    // Text inside the hover card, the find box and the suggestion list.
    descriptionForeground: t["text-secondary"],
    disabledForeground: t["text-disabled"],
    // "No results" is drawn in the error colour.
    errorForeground: t.danger,
    "icon.foreground": t["text-secondary"],
    focusBorder: t.focus,
    contrastBorder: edge,
    contrastActiveBorder: activeEdge,
    "widget.border": edge,
    "editorWidget.resizeBorder": t["border-strong"],
    "editorHoverWidget.statusBarBackground": t["bg-panel"],
    "editorSuggestWidgetStatus.foreground": t["text-secondary"],
    "textLink.foreground": t.cyan,
    "textLink.activeForeground": t.cyan,
    "textCodeBlock.background": t["bg-sunken"],
    "textPreformat.background": t["bg-sunken"],
    "textPreformat.border": edge,
    "textBlockQuote.background": t["bg-panel"],
    "textSeparator.foreground": t["border-strong"],
    // Edges Monaco draws only in high contrast.
    "editorStickyScroll.border": edge,
    "editorUnnecessaryCode.border": edge,
    "editorGhostText.border": edge,
    // The find box's field and toggles.
    "input.background": t["bg-raised"],
    "input.border": t["border-control"],
    "input.placeholderForeground": t["text-tertiary"],
    "inputOption.activeBackground": chosen,
    "inputOption.activeBorder": t.cyan,
    // A toggle sits inside the field, so its hover is the widget's own fill.
    "inputOption.hoverBackground": t["bg-elevated"],
    "inputValidation.errorBackground": t["bg-raised"],
    "inputValidation.errorBorder": t.danger,
    "inputValidation.warningBackground": t["bg-raised"],
    "inputValidation.warningBorder": t.warning,
    "inputValidation.infoBackground": t["bg-raised"],
    "inputValidation.infoBorder": t.cyan,
    "toolbar.activeBackground": t["bg-sunken"],
    "actionBar.toggledBackground": chosen,
    "sash.hoverBorder": t.focus,
    "progressBar.background": t.cyan,
    // Keyboard chips in the menu and the command list.
    "keybindingLabel.background": t["bg-raised"],
    "pickerGroup.foreground": t["text-secondary"],
    "list.deemphasizedForeground": t["text-secondary"],
    "list.errorForeground": t.danger,
    "list.warningForeground": t.warning,
    "list.invalidItemForeground": t.warning,
    "list.dropBetweenBackground": t.cyan,
    "list.filterMatchBackground": echo,
    "list.filterMatchBorder": activeEdge,
    // The command list keeps focus in its filter field, so its chosen row is
    // "inactive focus": the fill marks it, with no outline as well.
    "list.inactiveFocusOutline": activeEdge,
    "listFilterWidget.noMatchesOutline": t.danger,
    "menu.separatorBackground": t["border-strong"],
    "menu.selectionBorder": activeEdge,
    "tree.tableOddRowsBackground": clear,
    "tree.inactiveIndentGuidesStroke": t.border,
    "tree.tableColumnsBorder": t.border,
    // Controls Monaco's own dialogs use.
    "button.background": t.cyan,
    "button.foreground": t["on-cyan"],
    "button.hoverBackground": t.cyan,
    "button.separator": t["on-cyan"],
    "button.border": edge,
    "button.secondaryBackground": t["bg-panel"],
    "button.secondaryHoverBackground": t["bg-raised"],
    "button.secondaryBorder": t["border-control"],
    "badge.background": t.cyan,
    "badge.foreground": t["on-cyan"],
    "activityErrorBadge.background": t.danger,
    "activityErrorBadge.foreground": t["bg-base"],
    "activityWarningBadge.background": t.warning,
    "activityWarningBadge.foreground": t["bg-base"],
    "checkbox.background": t["bg-raised"],
    "checkbox.border": t["border-control"],
    "checkbox.selectBorder": t["border-control"],
    "checkbox.disabled.foreground": t["text-disabled"],
    "dropdown.background": t["bg-raised"],
    "dropdown.border": t["border-control"],
    "radio.activeBackground": chosen,
    "radio.activeBorder": t.cyan,
    "radio.inactiveBackground": clear,
    "radio.inactiveForeground": t["text-secondary"],
    "radio.inactiveBorder": t["border-control"],
    "breadcrumb.foreground": t["text-secondary"],
    "search.resultsInfoForeground": t["text-secondary"],
    "searchEditor.findMatchBackground": echo,
    "searchEditor.findMatchBorder": activeEdge,
    "charts.foreground": t["text-primary"],
    "charts.lines": t["border-strong"],
    "charts.red": t.danger,
    "charts.blue": t["syntax-keyword"],
    "charts.yellow": t.amber,
    "charts.orange": t.warning,
    "charts.green": t.success,
    "charts.purple": t.changed,
    "chart.line": t.cyan,
    "chart.axis": t["border-control"],
    "chart.guide": t.border,

    // Views this editor never opens (peek, diff, merge, inline edits), set so
    // none is left at a stock colour either.
    "peekView.border": t["border-strong"],
    "peekViewEditor.background": t["bg-sunken"],
    "peekViewEditorGutter.background": t["bg-sunken"],
    "peekViewEditorStickyScroll.background": t["bg-sunken"],
    "peekViewEditorStickyScrollGutter.background": t["bg-sunken"],
    "peekViewEditor.matchHighlightBackground": echo,
    "peekViewEditor.matchHighlightBorder": activeEdge,
    "peekViewResult.matchHighlightBackground": echo,
    "peekViewResult.lineForeground": t["text-secondary"],
    "peekViewTitleDescription.foreground": t["text-secondary"],
    "diffEditor.border": edge,
    "diffEditor.diagonalFill": t.border,
    "diffEditor.move.border": t["border-strong"],
    "diffEditor.moveActive.border": t.cyan,
    "diffEditor.unchangedCodeBackground": t["bg-sunken"],
    "diffEditor.unchangedRegionBackground": t["bg-sunken"],
    "diffEditor.unchangedRegionForeground": t["text-secondary"],
    "merge.border": edge,
    "merge.currentHeaderBackground": `${t.cyan}66`,
    "merge.currentContentBackground": `${t.cyan}26`,
    "merge.incomingHeaderBackground": `${t.changed}66`,
    "merge.incomingContentBackground": `${t.changed}26`,
    "merge.commonHeaderBackground": `${t["text-tertiary"]}66`,
    "merge.commonContentBackground": `${t["text-tertiary"]}26`,
    "editorOverviewRuler.currentContentForeground": t.cyan,
    "editorOverviewRuler.incomingContentForeground": t.changed,
    "editorOverviewRuler.commonContentForeground": t["text-tertiary"],
    "multiDiffEditor.headerBackground": t["bg-panel"],
    "multiDiffEditor.background": t["bg-base"],
    "inlineEdit.gutterIndicator.background": t["bg-elevated"],
    "inlineEdit.gutterIndicator.primaryBackground": t.cyan,
    "inlineEdit.gutterIndicator.primaryForeground": t["on-cyan"],
    "inlineEdit.gutterIndicator.primaryBorder": t.cyan,
    "inlineEdit.gutterIndicator.successfulBackground": t.success,
    "inlineEdit.gutterIndicator.successfulForeground": t["bg-base"],
    "inlineEdit.gutterIndicator.successfulBorder": t.success,
    "inlineEdit.tabWillAcceptModifiedBorder": t.cyan,
    "inlineEdit.tabWillAcceptOriginalBorder": t.cyan,
  };

  // The rest, by what the name says the colour paints. First match wins.
  const byKind: [RegExp, string][] = [
    // A suggestion's icon takes the colour of what it names in the code.
    [/^symbolIcon\.(function|method|constructor)Foreground$/, t["syntax-keyword"]],
    [/^symbolIcon\.(variable|field|property)Foreground$/, t["syntax-register"]],
    [/^symbolIcon\.(reference|module|namespace)Foreground$/, t["syntax-label"]],
    [/^symbolIcon\.\w+Foreground$/, t["text-secondary"]],
    // Indentation and bracket guides are hairlines; the active one is firmer.
    [/^editor(IndentGuide|BracketPairGuide)\.active\w*$/, t["border-strong"]],
    [/^editor(IndentGuide|BracketPairGuide)\.\w+$/, t.border],
    // Brackets in assembly are plain text, at every depth.
    [/^editorBracketHighlight\.foreground\d$/, t["text-primary"]],
    // Diff and inline-edit fills: added in the success colour, removed in danger.
    [/(inserted|modified)\w*Background$/i, `${t.success}26`],
    [/(removed|original)\w*Background$/i, `${t.danger}26`],
    [/(inserted|modified)\w*(Foreground|Border)$/i, t.success],
    [/(removed|original)\w*(Foreground|Border)$/i, t.danger],
    [/[Ss]hadow$/, shadow],
    [/[Hh]overBackground$/, hover],
    [/([Ss]election|[Ss]elected|[Ff]ocus|[Dd]rop)Background$/, chosen],
    // Matched letters: the interaction colour on a plain or hovered row,
    // primary text on the chosen row's dim fill.
    [/[Ff]ocusHighlightForeground$/, t["text-primary"]],
    [/[Hh]ighlightForeground$/, t.cyan],
    // Widget and row text, and the surface every widget sits on.
    [/[Ff]oreground$/, t["text-primary"]],
    [/[Bb]ackground$/, t["bg-elevated"]],
    [/[Ff]ocusOutline$/, t.focus],
    [/[Oo]utline$/, activeEdge],
    // Widget edges are hairlines, like the page's own panels.
    [/([Bb]order|[Ss]troke)$/, t["border-strong"]],
  ];

  const colors = { ...named };
  for (const colourId of colourIds) {
    if (colourId in colors) continue;
    const kind = byKind.find(([pattern]) => pattern.test(colourId));
    if (kind) colors[colourId] = kind[1];
  }
  return {
    base: hc ? "hc-black" : light ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: ink(t["syntax-keyword"]), fontStyle: "bold" },
      { token: "variable", foreground: ink(t["syntax-register"]) },
      { token: "number", foreground: ink(t["syntax-number"]) },
      { token: "number.hex", foreground: ink(t["syntax-number"]) },
      { token: "comment", foreground: ink(t["syntax-comment"]), fontStyle: "italic" },
      { token: "type.identifier", foreground: ink(t["syntax-label"]) },
    ],
    colors,
  };
}

/**
 * The terminal palette for one site theme. The one slot a program uses as a
 * background (black on dark themes, white on light ones) is a surface
 * colour; every other slot is an ink that reads on the terminal background.
 * The bright variants lean toward the primary text, so they read at least as
 * well as their base colour.
 */
export function xtermTheme(id: ThemeId): ITheme {
  const t = THEME_TOKENS[id];
  const light = themeInfo(id).kind === "light";
  const hue = ANSI_SOURCES[id];
  const bright = (hex: string) => mix(hex, t["text-primary"], 0.35);
  const base = {
    red: t[hue.red],
    green: t[hue.green],
    yellow: t[hue.yellow],
    blue: t[hue.blue],
    magenta: t[hue.magenta],
    cyan: t[hue.cyan],
  };
  return {
    background: t["bg-base"],
    foreground: t["text-primary"],
    cursor: t.amber,
    cursorAccent: t["bg-base"],
    selectionBackground: t.selection,
    black: light ? t["text-primary"] : t["bg-elevated"],
    white: light ? t["bg-elevated"] : t["text-secondary"],
    brightBlack: t["text-tertiary"],
    brightWhite: light ? t["text-secondary"] : t["text-primary"],
    ...base,
    brightRed: bright(base.red),
    brightGreen: bright(base.green),
    brightYellow: bright(base.yellow),
    brightBlue: bright(base.blue),
    brightMagenta: bright(base.magenta),
    brightCyan: bright(base.cyan),
  };
}
