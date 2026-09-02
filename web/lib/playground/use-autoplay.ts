"use client";

import { useEffect, useRef, type RefObject } from "react";
import { parseArgs } from "@/lib/playground/args";

// Autoplay cadence for the landing hero: a short step interval so the register
// flash and the pc marker read clearly, and a hard ceiling so the walk stays
// bounded regardless of the host-supplied step count.
const AUTOPLAY_STEP_MS = 450;
const AUTOPLAY_MAX_STEPS = 10;

/** The two machine calls the walk makes; the rest of the hub is none of its
 *  business. */
export interface AutoplayMachine {
  assemble(source: string, args: string[]): Promise<boolean>;
  step(): void;
}

export interface AutoplayParams {
  /** Off everywhere but the landing hero. */
  enabled: boolean;
  /** How many steps the walk takes, clamped to a small ceiling. */
  steps: number;
  /** The hub is live: nothing can assemble before this. */
  machineLoaded: boolean;
  /** The hub as a ref, never as a render value -- see the effect below. */
  machine: RefObject<AutoplayMachine>;
  source: string;
  args: string;
  /** Re-seed after the assemble, the same as every other assemble path. */
  applySeeds: () => void;
}

/**
 * The landing hero's hands-off walk: once the hub is loaded and the thread has
 * an idle slot, assemble the start program and step it a bounded number of
 * times on a timer so the registers flash and the pc marker advances with no
 * user action. Runs at most once per engage, and stands down entirely under
 * prefers-reduced-motion.
 */
export function useAutoplay({
  enabled,
  steps,
  machineLoaded,
  machine,
  source,
  args,
  applySeeds,
}: AutoplayParams): void {
  const hasAutoplayedRef = useRef(false);
  useEffect(() => {
    if (!enabled || !machineLoaded || hasAutoplayedRef.current) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hasAutoplayedRef.current = true;

    const walkSteps = Math.max(0, Math.min(steps, AUTOPLAY_MAX_STEPS));
    let timer: ReturnType<typeof setInterval> | null = null;
    let idleHandle: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const walk = async () => {
      // Assemble the machine directly rather than through the playground's
      // assemble-with-history, so the hero never pollutes the recent-programs
      // list, and await it so the steps land on a loaded program. The hub is
      // read through the ref so a register re-render cannot strand the timer
      // on a stale hub.
      const ok = await machine.current.assemble(source, parseArgs(args));
      if (ok) applySeeds();
      if (cancelled || !ok || walkSteps === 0) return;
      let stepped = 0;
      timer = setInterval(() => {
        machine.current.step();
        stepped += 1;
        if (stepped >= walkSteps && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, AUTOPLAY_STEP_MS);
    };
    // One idle slot before the first assemble. The walk starts the moment the
    // hub loads, which on the landing is inside the LCP window: the assemble
    // instantiates the wasm and the first steps re-render the whole register
    // file. The timeout bounds the wait so a busy thread cannot leave the hero
    // looking dead. hasAutoplayedRef is already set above, so a re-render
    // during the wait cannot queue a second walk.
    const start = () => {
      if (!cancelled) void walk();
    };
    if (typeof requestIdleCallback === "function") {
      idleHandle = requestIdleCallback(start, { timeout: 1200 });
    } else {
      idleTimer = setTimeout(start, 0);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleHandle);
        idleHandle = null;
      }
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    // Keyed STRICTLY on [machineLoaded, enabled]: useEmulator returns a NEW
    // object after every step (its memo deps include the changing
    // registers/pc), so keying on anything that moves with it would re-run
    // this effect after the first step, the cleanup would clear the timer,
    // and the once-per-engage guard would then block any restart -- the hero
    // would step once and freeze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineLoaded, enabled]);
}
