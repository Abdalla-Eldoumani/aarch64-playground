"use client";

import { Button } from "@/components/ui/Button";

export interface FirstRunStateProps {
  /**
   * Optional first-move affordance. When provided, a primary Assemble button
   * renders so the student's first action is a single click away.
   */
  onAssemble?: () => void;
}

/**
 * Shown before anything is assembled, so a first visit says what the
 * playground is and what to press instead of showing an empty listing.
 */
export function FirstRunState({ onAssemble }: FirstRunStateProps) {
  return (
    <div
      className="min-h-full w-full flex flex-col items-center justify-center gap-4 px-6 py-8 text-center"
      aria-label="no program assembled"
    >
      <p className="font-serif text-[19px] leading-relaxed text-[var(--text-primary)]">
        step through AArch64 assembly, right in this tab
        <span
          aria-hidden="true"
          className="anim-cursor-blink ml-1 inline-block h-[1.05em] w-[0.5em] translate-y-[0.12em] bg-[var(--amber)] align-baseline"
        />
      </p>
      <p className="max-w-sm font-sans text-[13px] leading-relaxed text-[var(--text-secondary)]">
        write or paste a program in the editor, then press{" "}
        <span className="font-mono text-[var(--text-primary)]">assemble</span> to
        load it. press step to advance one instruction at a time, or run to go
        to the end, and the registers, stack, and memory update as it executes.
      </p>
      {onAssemble && (
        <Button variant="primary" onClick={onAssemble} aria-label="assemble">
          assemble
        </Button>
      )}
    </div>
  );
}
