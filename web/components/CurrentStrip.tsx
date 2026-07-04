"use client";

import { useMemo } from "react";
import { describeLine, extractAliases } from "@/lib/explain-line";

export interface CurrentStripProps {
  /** Full source text -- needed to extract the line the CPU is on. */
  source: string;
  /** 1-based line of the most recently executed (or about-to-execute) instruction, or null. */
  currentLine: number | null;
}

/**
 * The prominent, always-on CURRENT instruction strip that sits just below the
 * register-panel header. A bold sans label names the surface; a mono gloss
 * reads out the instruction the CPU is on, sourced from the shared describe-line
 * module so the explanation logic lives in one place. Unlike the legacy explain
 * strip there is no toggle: the gloss is the beginner's lifeline and stays
 * visible, falling back to a calm prompt before the program is stepped.
 */
export function CurrentStrip({ source, currentLine }: CurrentStripProps) {
  const aliases = useMemo(() => extractAliases(source), [source]);

  const gloss = useMemo(() => {
    if (currentLine == null) return null;
    const raw = source.split("\n")[currentLine - 1] ?? "";
    return describeLine(raw, aliases);
  }, [source, currentLine, aliases]);

  return (
    <div
      className="w-full flex flex-col gap-1 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-raised)]"
      aria-label="current instruction"
    >
      <span className="font-sans font-semibold uppercase tracking-[0.08em] text-[12px] text-[var(--text-secondary)]">
        current instruction
      </span>
      {gloss ? (
        // Keyed by the line so each step replays the register-write flash on
        // the gloss: the strip is machine state, and it pulses with the same
        // --changed tint as a written register. Under prefers-reduced-motion
        // the class is inert and the updated text alone carries the change.
        <span
          key={currentLine}
          className="anim-reg-flash -mx-1 rounded-[var(--radius-control)] px-1 font-mono text-[14px] leading-[1.6] text-[var(--text-primary)] break-words"
        >
          {gloss}
        </span>
      ) : (
        <span className="font-mono text-[14px] leading-[1.6] text-[var(--text-tertiary)]">
          step the program to see the current instruction
        </span>
      )}
    </div>
  );
}
