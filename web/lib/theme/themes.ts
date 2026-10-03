/**
 * The themes a reader can pick, in the order the cycle and the pickers show
 * them. The first three ids predate the rest and must never change: saved
 * choices and `?theme=` links name them. Colours live in tokens.ts.
 */
export const THEMES = [
  { id: "dark", name: "dark", kind: "dark", description: "near black, amber for the running program, sky blue for buttons and links" },
  { id: "light", name: "light", kind: "light", description: "white with black text, dark gold for the running program, blue for buttons and links" },
  { id: "high-contrast", name: "high contrast", kind: "dark", description: "pure black with white text, gold for the running program, light blue for buttons and links" },
  { id: "ember", name: "ember", kind: "dark", description: "warm charcoal, orange for the running program, teal for buttons and links" },
  { id: "forest", name: "forest", kind: "dark", description: "green-black, warm yellow for the running program, mint green for buttons and links" },
  { id: "paper", name: "paper", kind: "light", description: "warm cream with brown text, dark gold for the running program, teal for buttons and links" },
] as const satisfies readonly {
  id: string;
  name: string;
  kind: "dark" | "light";
  description: string;
}[];

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id);

/** Where the choice is saved; the pre-paint script reads the same key. */
export const THEME_STORAGE_KEY = "aarch64-playground:theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function themeInfo(id: ThemeId): (typeof THEMES)[number] {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
