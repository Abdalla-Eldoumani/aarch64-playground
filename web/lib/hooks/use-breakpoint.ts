"use client";

import { useEffect, useState } from "react";

/**
 * Named Tailwind breakpoints. `xs` covers everything below `sm` (640px).
 * Call sites compare names instead of repeating pixel thresholds.
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

/** How a phone is held, or null when the screen is big enough for the
 *  tablet split and up. */
export type PhoneShape = "portrait" | "landscape" | null;

/**
 * Below 500px of height a phone is on its side: wide enough for the tablet
 * split but too short for it, which left an editor five lines tall and no
 * register rows at all. So the phone arrangement is chosen by height as well
 * as width.
 */
export function phoneShape(width: number, height: number): PhoneShape {
  if (width >= 768 && height >= 500) return null;
  return width > height ? "landscape" : "portrait";
}

/** The phone arrangement for the current viewport, tracking resizes and
 *  rotation. SSR-safe: null on the server and on the first client render. */
export function usePhoneShape(): PhoneShape {
  const [shape, setShape] = useState<PhoneShape>(null);
  useEffect(() => {
    const update = () => setShape(phoneShape(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return shape;
}
