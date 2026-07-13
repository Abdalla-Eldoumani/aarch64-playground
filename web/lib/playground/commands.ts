"use client";

/**
 * Shared action registry. The command palette, the `?` shortcuts modal,
 * and header buttons all pull their labels and handlers from here so
 * there's one source of truth for what the app can do.
 */
export interface Action {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  run: () => void;
}
