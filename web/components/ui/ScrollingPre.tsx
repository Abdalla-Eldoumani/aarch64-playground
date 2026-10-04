"use client";

import type { ReactNode } from "react";
import { SideScroll } from "@/components/ui/SideScroll";

export interface ScrollingPreProps {
  /** Classes for the box around the pre; margins go here, not on the pre. */
  className?: string;
  /** Classes for the pre itself, which always scrolls sideways. */
  preClassName: string;
  /** The fade's corners and colour; a pre on another surface than the
   *  sunken one passes its own. */
  fadeClassName?: string;
  children: ReactNode;
}

/**
 * A code box whose long lines scroll inside it, with the right-edge fade
 * SideScroll draws while a line runs past it. Every code box that can hold a
 * long line draws through it, so the cue looks the same everywhere.
 */
export function ScrollingPre({
  className,
  preClassName,
  fadeClassName = "rounded-r-[var(--radius-card)] from-[var(--bg-sunken)]",
  children,
}: ScrollingPreProps) {
  return (
    <SideScroll as="pre" className={className} scrollerClassName={preClassName} fadeClassName={fadeClassName}>
      {children}
    </SideScroll>
  );
}
