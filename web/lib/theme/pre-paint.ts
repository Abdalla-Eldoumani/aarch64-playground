import { THEME_IDS, THEME_STORAGE_KEY } from "@/lib/theme/themes";
import { THEME_TOKENS } from "@/lib/theme/tokens";

// Each theme's page colour, which is also its browser-chrome colour.
const THEME_COLORS = Object.fromEntries(THEME_IDS.map((id) => [id, THEME_TOKENS[id]["bg-base"]]));

/**
 * The inline script app/layout.tsx runs in <head>, before first paint, so the
 * page never flashes a theme the reader did not pick. Precedence: a saved id
 * that is still a theme, then the OS asking for more contrast, then the OS
 * light scheme, then dark. use-theme's resolveTheme is its twin; a test runs
 * both over the same cases. The prepended theme-color meta has no media, so
 * the browser prefers it over the two OS-scheme ones in the metadata.
 */
export const PRE_PAINT_SCRIPT =
  "try{var d=document.documentElement,c=" +
  JSON.stringify(THEME_COLORS) +
  ",t=null;try{t=localStorage.getItem(" +
  JSON.stringify(THEME_STORAGE_KEY) +
  ")}catch(e){}" +
  'if(!Object.prototype.hasOwnProperty.call(c,t))t=matchMedia("(prefers-contrast: more)").matches?"high-contrast":matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";' +
  'd.setAttribute("data-theme",t);var m=document.createElement("meta");m.name="theme-color";m.content=c[t];document.head.prepend(m)}catch(e){}';
