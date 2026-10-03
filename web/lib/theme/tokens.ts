import type { ThemeId } from "./themes";

/**
 * Every colour the site paints, one block per theme. This file is the only
 * place a colour value is written: the Tailwind config turns these blocks into
 * the `[data-theme]` custom properties, and the editor, terminal, theme-color
 * and manifest read them from here. Contrast and role distance are held by
 * the theme tests.
 *
 * The `amber` and `cyan` names are historical: `amber` is whatever colour
 * means the machine is acting in that theme, `cyan` whatever means you are.
 */
export interface ThemeTokens {
  "bg-base": string;
  "bg-sunken": string;
  "bg-raised": string;
  "bg-panel": string;
  "bg-elevated": string;
  /** Hairlines and dividers; decoration, so no contrast bar. */
  border: string;
  "border-strong": string;
  /** The edge of a text field: 3:1 so the field can be found. */
  "border-control": string;
  "text-primary": string;
  "text-secondary": string;
  "text-tertiary": string;
  /** Disabled controls: 3:1, fainter than tertiary but still readable. */
  "text-disabled": string;
  /** Execution: the pc, the current line, run. */
  amber: string;
  "amber-dim": string;
  /** Interaction: links, focus, primary actions, the selected tab. */
  cyan: string;
  "cyan-dim": string;
  /** Text and icons on a filled cyan control. */
  "on-cyan": string;
  success: string;
  warning: string;
  danger: string;
  /** The just-written value's ink; the flash itself is the amber write bar. */
  changed: string;
  focus: string;
  /** Selected text: translucent (#RRGGBBAA) so the editor's own marks show through. */
  selection: string;
  /** Blueprint grid on reading pages (translucent), and the crop marks. */
  "grid-line": string;
  crop: string;
  "syntax-keyword": string;
  "syntax-register": string;
  "syntax-number": string;
  /** The editor grammar has no string token, so strings reuse the number hue. */
  "syntax-string": string;
  "syntax-comment": string;
  "syntax-label": string;
}

const dark: ThemeTokens = {
  "bg-base": "#0B0C10",
  "bg-sunken": "#0F1116",
  "bg-raised": "#14171D",
  "bg-panel": "#191D24",
  "bg-elevated": "#212630",
  border: "#262B33",
  "border-strong": "#3A414C",
  "border-control": "#6E7582",
  "text-primary": "#EDEEF1",
  "text-secondary": "#A5ACB6",
  "text-tertiary": "#8B939E",
  "text-disabled": "#6B727E",
  amber: "#FFB224",
  "amber-dim": "#7A5510",
  cyan: "#3EC5E8",
  "cyan-dim": "#1B6376",
  "on-cyan": "#052430",
  success: "#4ADE80",
  warning: "#FFB454",
  danger: "#FF6B6B",
  changed: "#FFCB5E",
  focus: "#3EC5E8",
  selection: "#3EC5E824",
  "grid-line": "#EDEEF108",
  crop: "#4A515C",
  "syntax-keyword": "#6FA8FF",
  "syntax-register": "#FF7EB6",
  "syntax-number": "#B49BFF",
  "syntax-string": "#B49BFF",
  "syntax-comment": "#8B939E",
  "syntax-label": "#3DD68C",
};

// Ink on blueprint paper. The state hues sit darker than their dark-theme
// cousins so that, as text, they clear 4.5:1 on their own tint bands too.
const light: ThemeTokens = {
  "bg-base": "#FCFCFD",
  "bg-sunken": "#F4F5F7",
  "bg-raised": "#FFFFFF",
  "bg-panel": "#FFFFFF",
  "bg-elevated": "#E9EBEF",
  border: "#E2E5EA",
  "border-strong": "#C9CED6",
  "border-control": "#7A818C",
  "text-primary": "#14161A",
  "text-secondary": "#565E68",
  "text-tertiary": "#5B626A",
  "text-disabled": "#7B828C",
  amber: "#81520C",
  "amber-dim": "#E7CD96",
  cyan: "#0C6882",
  "cyan-dim": "#9AD3DF",
  "on-cyan": "#FFFFFF",
  success: "#186A2D",
  warning: "#8D5400",
  danger: "#B2322B",
  changed: "#895600",
  focus: "#0C6882",
  selection: "#0C688226",
  "grid-line": "#14161A0A",
  crop: "#B9C0C9",
  "syntax-keyword": "#1D4ED8",
  "syntax-register": "#BB185C",
  "syntax-number": "#6D28D9",
  "syntax-string": "#6D28D9",
  "syntax-comment": "#5A626B",
  "syntax-label": "#036B4D",
};

// Pure black, white hairlines, 7:1 text, the grid texture off.
const highContrast: ThemeTokens = {
  "bg-base": "#000000",
  "bg-sunken": "#0A0A0A",
  "bg-raised": "#141414",
  "bg-panel": "#141414",
  "bg-elevated": "#1E1E1E",
  border: "#FFFFFF",
  "border-strong": "#FFFFFF",
  "border-control": "#FFFFFF",
  "text-primary": "#FFFFFF",
  "text-secondary": "#E6E6E6",
  "text-tertiary": "#C7C7C7",
  "text-disabled": "#ABABAB",
  amber: "#FFC247",
  "amber-dim": "#6B4A00",
  cyan: "#5AD7F0",
  "cyan-dim": "#13606F",
  "on-cyan": "#00181E",
  success: "#5CF06B",
  warning: "#FFC247",
  danger: "#FF9595",
  changed: "#FFD480",
  focus: "#FFFFFF",
  selection: "#5AD7F02E",
  "grid-line": "#00000000",
  crop: "#FFFFFF",
  "syntax-keyword": "#8BE0FF",
  "syntax-register": "#FFB6E6",
  "syntax-number": "#D4B6FF",
  "syntax-string": "#D4B6FF",
  "syntax-comment": "#D1D5DB",
  "syntax-label": "#9EF0C1",
};

// Warm charcoal: the running program glows orange, your controls are teal.
const ember: ThemeTokens = {
  "bg-base": "#14100D",
  "bg-sunken": "#18130F",
  "bg-raised": "#1E1814",
  "bg-panel": "#241D18",
  "bg-elevated": "#2E2520",
  border: "#352B24",
  "border-strong": "#5A4536",
  "border-control": "#86766A",
  "text-primary": "#F5EBE1",
  "text-secondary": "#D6BBA4",
  "text-tertiary": "#B59F8C",
  "text-disabled": "#8A7666",
  amber: "#F98637",
  "amber-dim": "#7A3A10",
  cyan: "#5CCFC3",
  "cyan-dim": "#1D5E57",
  "on-cyan": "#062320",
  success: "#82DC73",
  warning: "#EEC84B",
  danger: "#F96A82",
  changed: "#C8A2F5",
  focus: "#5CCFC3",
  selection: "#5CCFC32B",
  "grid-line": "#F5EBE109",
  crop: "#6E5241",
  "syntax-keyword": "#EBA877",
  "syntax-register": "#FF96B0",
  "syntax-number": "#93B8FF",
  "syntax-string": "#93B8FF",
  "syntax-comment": "#B59F8C",
  "syntax-label": "#8FD9B8",
};

// Green-black: warm yellow for the machine, mint for you.
const forest: ThemeTokens = {
  "bg-base": "#0C1712",
  "bg-sunken": "#0F1C16",
  "bg-raised": "#14231B",
  "bg-panel": "#1A2B22",
  "bg-elevated": "#22362B",
  border: "#27392F",
  "border-strong": "#3D5245",
  "border-control": "#708677",
  "text-primary": "#E6F2EA",
  "text-secondary": "#A9C2B3",
  "text-tertiary": "#90AA9C",
  "text-disabled": "#6E8777",
  amber: "#FFD166",
  "amber-dim": "#6B5315",
  cyan: "#5FE3BE",
  "cyan-dim": "#1C6B57",
  "on-cyan": "#05241B",
  success: "#B4E36A",
  warning: "#FF8C4D",
  danger: "#FF7B92",
  changed: "#C3A6FF",
  focus: "#5FE3BE",
  selection: "#5FE3BE29",
  "grid-line": "#E6F2EA09",
  crop: "#4B6356",
  "syntax-keyword": "#8CCBFF",
  "syntax-register": "#FF9DBB",
  "syntax-number": "#E0B8F2",
  "syntax-string": "#E0B8F2",
  "syntax-comment": "#90AA9C",
  "syntax-label": "#B4E36A",
};

// Warm cream and brown ink, dark gold for the machine, teal for you.
const paper: ThemeTokens = {
  "bg-base": "#FBF7EE",
  "bg-sunken": "#F6F1E6",
  "bg-raised": "#FFFDF8",
  "bg-panel": "#FFFDF8",
  "bg-elevated": "#EDE6D8",
  border: "#E1D7C3",
  "border-strong": "#CBBEA6",
  "border-control": "#8A7A62",
  "text-primary": "#2A2019",
  "text-secondary": "#5E4E40",
  "text-tertiary": "#645343",
  "text-disabled": "#8C7B68",
  amber: "#735A00",
  "amber-dim": "#EBCF96",
  cyan: "#0A5F6B",
  "cyan-dim": "#A3D3D6",
  "on-cyan": "#FFFFFF",
  success: "#2F6419",
  warning: "#9C3F06",
  danger: "#AB1D44",
  changed: "#8A37A3",
  focus: "#0A5F6B",
  selection: "#0A5F6B26",
  "grid-line": "#2A20190A",
  crop: "#C4B69C",
  "syntax-keyword": "#1D4B9E",
  "syntax-register": "#962056",
  "syntax-number": "#5E35A0",
  "syntax-string": "#5E35A0",
  "syntax-comment": "#645343",
  "syntax-label": "#17613F",
};

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  dark,
  light,
  "high-contrast": highContrast,
  ember,
  forest,
  paper,
};

type AnsiHue = "red" | "green" | "yellow" | "blue" | "magenta" | "cyan";

/**
 * Which token each ANSI hue borrows in the terminal. A program that prints
 * yellow expects yellow, so a theme whose machine colour is orange takes its
 * yellow from another token of that hue.
 */
const ANSI_DEFAULT: Record<AnsiHue, keyof ThemeTokens> = {
  red: "danger",
  green: "success",
  yellow: "amber",
  blue: "syntax-keyword",
  magenta: "syntax-number",
  cyan: "cyan",
};

export const ANSI_SOURCES: Record<ThemeId, Record<AnsiHue, keyof ThemeTokens>> = {
  dark: ANSI_DEFAULT,
  light: ANSI_DEFAULT,
  "high-contrast": ANSI_DEFAULT,
  ember: { ...ANSI_DEFAULT, yellow: "warning", blue: "syntax-number", magenta: "changed" },
  forest: { ...ANSI_DEFAULT, magenta: "changed" },
  paper: { ...ANSI_DEFAULT, magenta: "changed" },
};

/** Colour tokens every theme shares, written once on :root. */
export const SHARED_TOKENS = {
  "shadow-overlay": "0 1px 2px #0000004D, 0 8px 24px #00000040",
  "shadow-frame": "0 1px 2px #0000004D, 0 12px 32px #00000059",
};

/**
 * The custom-property rules the Tailwind config adds to the base layer.
 * Dark is also the default, so its block covers :root. Each block is an
 * attribute selector, so an element carrying `data-theme` paints in that
 * theme wherever it sits.
 */
export function themeCssBlocks(): Record<string, Record<string, string>> {
  const vars = (tokens: object) =>
    Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--${name}`, value]));
  const blocks: Record<string, Record<string, string>> = { ":root": vars(SHARED_TOKENS) };
  for (const [id, tokens] of Object.entries(THEME_TOKENS)) {
    blocks[id === "dark" ? ':root, [data-theme="dark"]' : `[data-theme="${id}"]`] = vars(tokens);
  }
  return blocks;
}
