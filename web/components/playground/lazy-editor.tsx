"use client";

import dynamic from "next/dynamic";

/**
 * The editor, reached lazily. Monaco (and the loader that fetches its runtime)
 * is the largest module the app owns, and only an EDITABLE surface ever needs
 * it: the landing hero draws its program with StaticCodeView, so the landing's
 * script list must not name the editor chunk at all. A static import from the
 * shell put it there whether or not any editor rendered.
 *
 * Its own module, and module scope inside it, for the reason lazy-panels.tsx
 * gives: a dynamic() call re-evaluated per render hands React a new component
 * type and remounts the editor, losing the cursor and the undo stack.
 */
export const Editor = dynamic(
  () => import("@/components/playground/Editor").then((m) => m.Editor),
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
