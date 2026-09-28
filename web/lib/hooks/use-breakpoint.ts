"use client";

import { useSyncExternalStore } from "react";

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

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/**
 * The current breakpoint, tracking window resizes. The server and a hydrating
 * render see `lg`, so server HTML stays stable; a component that mounts after
 * hydration reads the real width on its first render. Both callers mount that
 * way, and reading the width one effect late made every phone and tablet mount
 * the laptop layout, lay it out, and throw it away a frame later.
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(
    subscribeResize,
    () => classify(window.innerWidth),
    (): Breakpoint => "lg",
  );
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
 *  rotation. Null on the server and in a hydrating render, like
 *  useBreakpoint's `lg`. */
export function usePhoneShape(): PhoneShape {
  return useSyncExternalStore(
    subscribeResize,
    () => phoneShape(window.innerWidth, window.innerHeight),
    (): PhoneShape => null,
  );
}
