"use client";

import dynamic from "next/dynamic";
import { fontsSettled } from "@/components/playground/fonts-settled";

/**
 * The editor, reached lazily. Monaco (and the loader that fetches its runtime)
 * is the largest module the app owns, and only an EDITABLE surface ever needs
 * it: the landing hero draws its program with StaticCodeView, so the landing's
 * script list must not name the editor chunk at all. A static import from the
 * shell puts it there whether or not any editor renders.
 *
 * Its own module, and module scope inside it, for the reason lazy-panels.tsx
 * gives: a dynamic() call re-evaluated per render hands React a new component
 * type and remounts the editor, losing the cursor and the undo stack.
 *
 * The web fonts are awaited beside the chunk: Monaco measures one glyph's
 * advance at creation and lays its whole grid on it, so an editor created in
 * the fallback face keeps the wrong column width after the swap.
 */
export const Editor = dynamic(
  () =>
    Promise.all([import("@/components/playground/Editor"), fontsSettled()]).then(
      ([m]) => m.Editor,
    ),
  {
    ssr: false,
    // The same beat the shell shows before it engages, so a surface that
    // starts editable does not change height while the chunk arrives.
    loading: () => (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)] text-sm">
        loading editor...
      </div>
    ),
  },
);
