"use client";

import { Button } from "@/components/Button";

export interface FirstRunStateProps {
  /**
   * Optional first-move affordance. When provided, a primary Assemble button
   * renders so the student's first action is a single click away.
   */
  onAssemble?: () => void;
}

/**
 * The designed cold-load / no-program-assembled state. Instead of a blank dense
 * IDE, a short serif lead names the surface and a plain line says what to press,
 * anchored by the brand block cursor (amber = the machine acting; it blinks via
 * the cursor-blink motion token and holds solid under prefers-reduced-motion).
 * Kept self-contained so the landing hero can reuse the same composition.
 */
export function FirstRunState({ onAssemble }: FirstRunStateProps) {
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center gap-4 px-6 py-8 text-center"
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
        write or paste a program on the left, then press{" "}
        <span className="font-mono text-[var(--text-primary)]">Assemble</span> to
        load it. Step one instruction at a time or Run to the end, and the
        registers, stack, and memory update as it executes.
      </p>
      {onAssemble && (
        <Button variant="primary" onClick={onAssemble} aria-label="assemble">
          assemble
        </Button>
      )}
    </div>
  );
}
