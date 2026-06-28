import type { JSX } from "react";

/**
 * Static AAPCS64 stack-frame teaching diagram: the high-to-low memory layout of
 * a frame. High address at the top, low at the bottom -- the caller's frame sits
 * above, the prologue's `stp fp, lr, [sp, alloc]!` saves fp/lr at the frame base
 * (where fp then points), locals sit below addressed off fp, and sp sits at the
 * lowest allocated slot, kept 16-byte aligned at a call boundary. This is
 * presentational only: no runtime, reads no live debugger state, deliberately
 * not the interactive stack view. Token-only and reduced-motion safe (no motion
 * at all).
 */

interface FrameBand {
  label: string;
  detail: string;
  /** A pointer marker that anchors at this band (e.g. the frame pointer). */
  marker?: string;
}

const BANDS: FrameBand[] = [
  { label: "caller's frame", detail: "higher addresses, owned by the caller" },
  {
    label: "saved fp, lr",
    detail: "stp fp, lr, [sp, alloc]!",
    marker: "fp (x29)",
  },
  { label: "locals", detail: "addressed off the frame pointer, e.g. [fp, -16]" },
];

/** A token-driven pointer-chip tint, kept theme-following with color-mix. */
const POINTER_STYLE = {
  borderColor: "var(--cyan)",
  backgroundColor: "color-mix(in srgb, var(--cyan) 12%, transparent)",
} as const;

export function StackFrameDiagram({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="aapcs64 stack frame layout"
      className={`flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] p-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-secondary)]">
        <span>high addresses</span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true">{"↓"}</span>
          grows downward (high -&gt; low)
        </span>
        <span className="rounded-[var(--radius-control)] border border-[var(--border-strong)] px-2 py-0.5 font-mono text-[var(--text-primary)]">
          16-byte aligned
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {BANDS.map((band) => (
          <li
            key={band.label}
            className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-mono text-[13px] text-[var(--text-primary)]">
                {band.label}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                {band.detail}
              </span>
            </span>
            {band.marker ? (
              <span
                className="shrink-0 rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
                style={POINTER_STYLE}
              >
                {band.marker}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <div
        className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2"
        style={POINTER_STYLE}
      >
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
          top of stack (lowest address)
        </span>
        <span className="shrink-0 font-mono text-[13px] text-[var(--text-primary)]">
          sp
        </span>
      </div>

      <span className="text-[12px] text-[var(--text-secondary)]">
        low addresses
      </span>
    </section>
  );
}
