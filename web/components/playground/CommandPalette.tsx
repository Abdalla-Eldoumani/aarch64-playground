"use client";

import { Command } from "cmdk";
import { useEffect, useRef } from "react";
import type { Action } from "@/lib/playground/commands";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: Action[];
}

/**
 * Cmd+K / Ctrl+K modal. Renders every registered `Action`, uses cmdk's
 * built-in fuzzy ranking, and runs the chosen action on Enter.
 */
export function CommandPalette({ open, onClose, actions }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search input whenever the palette opens so the student
  // can just start typing.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[10vh] px-3"
      role="dialog"
      aria-modal="true"
      aria-label="command palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-md border border-[var(--border)] bg-[var(--bg-sunken)] shadow-2xl overflow-hidden anim-modal-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="command palette" className="flex flex-col">
          <Command.Input
            ref={inputRef}
            placeholder="type a command..."
            className="w-full bg-transparent px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border-b border-[var(--border)] focus:outline-none"
          />
          <Command.List className="max-h-[50vh] overflow-auto">
            <Command.Empty className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
              no matches
            </Command.Empty>
            {actions.map((a) => (
              <Command.Item
                key={a.id}
                value={`${a.label} ${a.description}`}
                onSelect={() => {
                  a.run();
                  onClose();
                }}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm cursor-pointer data-[selected=true]:bg-[var(--bg-panel)] data-[selected=true]:text-[var(--cyan)]"
              >
                <div className="flex flex-col">
                  <span>{a.label}</span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {a.description}
                  </span>
                </div>
                {a.shortcut && (
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)]">
                    {a.shortcut}
                  </kbd>
                )}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
