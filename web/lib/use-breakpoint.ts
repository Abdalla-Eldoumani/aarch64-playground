"use client";

import { useEffect, useState } from "react";

/**
 * Named Tailwind breakpoints. `xs` covers everything below `sm` (640px).
 * Components can ask "which breakpoint are we at right now?" without
 * hard-coding pixel thresholds at every call site.
 */
export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const ORDER: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];

function classify(width: number): Breakpoint {
  if (width >= 1536) return "2xl";
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  if (width >= 640) return "sm";
  return "xs";
}

/**
 * Subscribe to window resize and return the current breakpoint. SSR-safe:
 * renders as `lg` on the server and flips to the correct value on the
 * first client effect so server-rendered HTML stays stable.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("lg");
  useEffect(() => {
    const update = () => setBp(classify(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return bp;
}

export function isAtLeast(bp: Breakpoint, min: Breakpoint): boolean {
  return ORDER.indexOf(bp) >= ORDER.indexOf(min);
}
