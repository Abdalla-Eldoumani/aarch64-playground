import type { JSX } from "react";
import { Band, StackColumn, type BandProps } from "@/components/diagrams/FrameWalk";

/**
 * A still picture of the stack at one moment, frame by frame, drawn with the
 * frame walk's bands so the two read alike. Cyan bands hold passed values,
 * amber bands hold saved registers, and the cyan chips are where a register
 * points.
 */

export interface StackFrame {
  /** The frame's owner, e.g. "main's frame"; unique within the diagram. */
  title: string;
  /** High addresses first. */
  bands: BandProps[];
}

export function StackDiagram({
  label,
  frames,
  className = "",
}: {
  label: string;
  frames: StackFrame[];
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label={label}
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <StackColumn>
        {frames.map((frame) => (
          <div key={frame.title} className="flex flex-col gap-1.5">
            <h3 className="text-[12px] uppercase tracking-wider text-[var(--text-secondary)]">
              {frame.title}
            </h3>
            <ul aria-label={frame.title} className="flex flex-col gap-2">
              {frame.bands.map((band) => (
                <Band key={band.label} {...band} />
              ))}
            </ul>
          </div>
        ))}
      </StackColumn>
    </section>
  );
}
