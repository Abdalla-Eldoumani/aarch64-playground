import type { CSSProperties, JSX } from "react";

/**
 * One 128-bit vector register drawn once per name: the five scalar names
 * (q, d, s, h, b) as the low bits each one reads, then the four 128-bit lane
 * arrangements. Every bar is the same 16 bytes, bit 127 at the left and bit 0
 * at the right, so the names line up on the bits they share. Static: it
 * never runs, so it uses no amber and has nothing to animate.
 */

interface ScalarView {
  name: string;
  /** How many low bytes the name covers. */
  bytes: number;
  note: string;
}

interface LaneView {
  name: string;
  lanes: number;
  note: string;
}

const SCALARS: ScalarView[] = [
  { name: "q0", bytes: 16, note: "bits 127:0" },
  { name: "d0", bytes: 8, note: "bits 63:0, a double" },
  { name: "s0", bytes: 4, note: "bits 31:0, a float" },
  { name: "h0", bytes: 2, note: "bits 15:0" },
  { name: "b0", bytes: 1, note: "bits 7:0" },
];

const ARRANGEMENTS: LaneView[] = [
  { name: "v0.2d", lanes: 2, note: "2 lanes of 64 bits" },
  { name: "v0.4s", lanes: 4, note: "4 lanes of 32 bits" },
  { name: "v0.8h", lanes: 8, note: "8 lanes of 16 bits" },
  { name: "v0.16b", lanes: 16, note: "16 lanes of 8 bits" },
];

const ROW = "grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-3";
const BAR = "grid h-8 grid-cols-[repeat(16,minmax(0,1fr))] gap-[3px]";
// Solid ink for the bits a name reads, a dashed outline for the bits it
// leaves alone. Both strokes keep 3:1 against the card in every theme.
const NAMED =
  "flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--text-secondary)] bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)]";
const UNNAMED = "rounded-[var(--radius-control)] border border-dashed border-[var(--text-tertiary)]";
const HEADING = "text-[12px] uppercase tracking-wider text-[var(--text-secondary)]";

const span = (bytes: number): CSSProperties => ({ gridColumn: `span ${bytes} / span ${bytes}` });

function Label({ name, note }: { name: string; note: string }): JSX.Element {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 sm:flex-col sm:gap-0">
      <span className="font-mono text-[13px] text-[var(--text-primary)]">{name}</span>
      <span className="text-[12px] text-[var(--text-secondary)]">{note}</span>
    </span>
  );
}

export function VectorRegisterViews({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="one vector register, every name"
      className={`flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <div aria-hidden="true" className={ROW}>
        <span className="hidden sm:block" />
        <span className="grid grid-cols-2 gap-[3px] font-mono text-[12px] text-[var(--text-tertiary)]">
          <span className="flex justify-between">
            <span>127</span>
            <span>64</span>
          </span>
          <span className="flex justify-between">
            <span>63</span>
            <span>0</span>
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={HEADING}>scalar names</h3>
        <ul className="flex flex-col gap-3">
          {SCALARS.map((view) => (
            <li key={view.name} className={ROW}>
              <Label name={view.name} note={view.note} />
              <span aria-hidden="true" className={BAR}>
                {view.bytes < 16 && <span className={UNNAMED} style={span(16 - view.bytes)} />}
                <span className={NAMED} style={span(view.bytes)} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={HEADING}>vector arrangements</h3>
        <ul className="flex flex-col gap-3">
          {ARRANGEMENTS.map((view) => {
            const width = 16 / view.lanes;
            // Lane numbers fit two bytes or wider; 16 one-byte lanes get none.
            const numbered = width >= 2;
            return (
              <li key={view.name} className={ROW}>
                <Label name={view.name} note={view.note} />
                <span aria-hidden="true" className={BAR}>
                  {Array.from({ length: view.lanes }, (_, i) => view.lanes - 1 - i).map((lane) => (
                    <span
                      key={lane}
                      className={`${NAMED} font-mono text-[12px] text-[var(--text-primary)]`}
                      style={span(width)}
                    >
                      {numbered ? lane : null}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
