"use client";

import type { CSSProperties } from "react";

export interface ZoomControlProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Tiny zoom control: `-`, percentage, `+`, reset. Each button is 24x24,
 * sized for the panel header rather than for a coarse pointer.
 */
export function ZoomControl({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  className = "",
  style,
}: ZoomControlProps) {
  const pct = Math.round(scale * 100);
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      role="group"
      aria-label="zoom"
      style={style}
    >
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="zoom out"
        className="touch-target w-6 h-6 flex items-center justify-center text-[11px] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
      >
        -
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label={`reset zoom (currently ${pct} percent)`}
        className="touch-target min-w-[2.5rem] h-6 px-1 text-[10px] font-mono rounded [@media(pointer:coarse)]:text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="zoom in"
        className="touch-target w-6 h-6 flex items-center justify-center text-[11px] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
      >
        +
      </button>
    </div>
  );
}
