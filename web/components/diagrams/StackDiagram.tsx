import type { JSX } from "react";
import { Band, StackColumn, type BandProps } from "@/components/diagrams/FrameWalk";

/**
 * A still picture of the stack at one moment, frame by frame, drawn with the
 * frame walk's bands, which are the frames view's rows: each band's offset
 * on the left, a saved fp or lr in the saved colour, a slot the code names
 * in the local colour, and where sp and fp point on the right.
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
            <ul aria-label={frame.title}>
              {/* Every band keeps the offset column, so the boxes line up. */}
              {frame.bands.map((band) => (
                <Band key={band.label} offset="" {...band} />
              ))}
            </ul>
          </div>
        ))}
      </StackColumn>
    </section>
  );
}
