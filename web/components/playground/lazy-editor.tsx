"use client";

import dynamic from "next/dynamic";
import { fontsSettled } from "@/components/playground/fonts-settled";

/**
 * Monaco, the app's largest module, loaded only where an editable surface
 * renders, so the landing never downloads it. Module scope, because a
 * dynamic() call per render remounts the editor and loses the undo history.
 * It waits for the fonts: Monaco sets its column width from the font it
 * starts with.
 */
export const Editor = dynamic(
  () =>
    Promise.all([import("@/components/playground/Editor"), fontsSettled()]).then(
      ([m]) => m.Editor,
    ),
  {
    ssr: false,
    // Matches the shell's own loading placeholder, so a surface that starts
    // editable does not change height while the chunk arrives.
    loading: () => (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)] text-sm">
        loading editor...
      </div>
    ),
  },
);
