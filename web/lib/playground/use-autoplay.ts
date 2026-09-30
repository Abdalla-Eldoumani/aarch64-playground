"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { parseArgs } from "@/lib/playground/args";

// Autoplay cadence for the landing hero: a short step interval so the register
// flash and the pc marker read clearly, and a hard ceiling so the walk stays
// bounded regardless of the host-supplied step count.
const AUTOPLAY_STEP_MS = 450;
const AUTOPLAY_MAX_STEPS = 10;

// How long the demo keeps its boxes still after the reader's last wheel turn
// or touch anywhere on the page. A box that scrolls under a moving finger or
// pointer reads as the page fighting back.
const READER_STILL_MS = 1000;

/** The two machine calls the walk makes; the rest of the hub is none of its
 *  business. */
export interface AutoplayMachine {
  assemble(source: string, args: string[]): Promise<boolean>;
  step(): void;
}

/**
 * Where the walk stands, for the host's control. `playing` steps on its timer
 * (and holds by itself while the demo is off screen or the tab is hidden),
 * `paused` waits for the reader, `stepping` moves one line per press under
 * reduced motion, and `done` has taken every step.
 */
export type WalkState = "playing" | "paused" | "stepping" | "done";

/** What the host's control asks the walk for. */
export type WalkCommand = "pause" | "resume" | "replay" | "step";

export interface AutoplayParams {
  /** Off everywhere but the landing hero. */
  enabled: boolean;
  /** How many steps the walk takes, clamped to a small ceiling. */
  steps: number;
  /** The hub is live: nothing can assemble before this. */
  machineLoaded: boolean;
  /** The hub as a ref, never as a render value; see the effect below. */
  machine: RefObject<AutoplayMachine>;
  source: string;
  args: string;
  /** Re-seed after the assemble, the same as every other assemble path. */
  applySeeds: () => void;
  /** The demo's frame: the walk holds while none of it is on screen. */
  frame: RefObject<HTMLElement | null>;
  /** Told each time the walk's state changes. */
  onChange?: (state: WalkState) => void;
}

/**
 * The landing hero's walk: once the hub is loaded and the thread has an idle
 * slot, assemble the start program and step it a bounded number of times on a
 * timer, so the registers flash and the pc marker advances with no user
 * action. It holds while the frame is off screen or the tab is hidden and
 * picks up where it stopped. Under prefers-reduced-motion nothing moves on its
 * own: each `step` command loads or advances the program by one line.
 * Returns the command function the host's control calls; it is stable.
 */
export function useAutoplay(params: AutoplayParams): (command: WalkCommand) => void {
  const { enabled, machineLoaded } = params;
  // Everything but the two keys is read when it is needed, not when the effect
  // starts: useEmulator hands back a new object after every step.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });
  const commandRef = useRef<(command: WalkCommand) => void>(() => {});

  useEffect(() => {
    if (!enabled || !machineLoaded) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const walkSteps = Math.max(0, Math.min(latest.current.steps, AUTOPLAY_MAX_STEPS));
    let manual = reduce.matches;
    let stepped = 0;
    let loaded = false;
    let loading = false;
    let pausedByReader = false;
    let offscreen = false;
    let hidden = document.visibilityState === "hidden";
    // Bumped by every load and by the cleanup, so an assemble that resolves
    // after a replay or an unmount cannot start a second timer.
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let reported: WalkState | null = null;

    const report = () => {
      const state: WalkState =
        stepped >= walkSteps ? "done" : manual ? "stepping" : pausedByReader ? "paused" : "playing";
      if (state === reported) return;
      reported = state;
      latest.current.onChange?.(state);
    };
    const stop = () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    };
    const step = () => {
      latest.current.machine.current.step();
      stepped += 1;
      report();
    };
    // One step per tick while nothing holds the walk.
    const schedule = () => {
      if (timer !== null || manual || !loaded || pausedByReader) return;
      if (offscreen || hidden || stepped >= walkSteps) return;
      timer = setTimeout(() => {
        timer = null;
        step();
        schedule();
      }, AUTOPLAY_STEP_MS);
    };
    // Assemble the machine directly rather than through the playground's
    // assemble-with-history, so the hero never touches the recent-programs
    // list. The assemble resets the machine, so a replay starts from the top.
    const load = async () => {
      const mine = ++generation;
      stop();
      loaded = false;
      loading = true;
      stepped = 0;
      report();
      const { machine, source, args, applySeeds } = latest.current;
      const ok = await machine.current.assemble(source, parseArgs(args));
      if (mine !== generation) return;
      loading = false;
      if (!ok) {
        // Nothing to walk; replay is the way to try again.
        stepped = walkSteps;
        report();
        return;
      }
      applySeeds();
      loaded = true;
      schedule();
    };
    const holdOrGo = () => {
      if (offscreen || hidden) stop();
      else schedule();
    };

    commandRef.current = (command) => {
      if (command === "pause" && !manual) {
        pausedByReader = true;
        stop();
        report();
      } else if (command === "resume") {
        pausedByReader = false;
        report();
        schedule();
      } else if (command === "replay") {
        pausedByReader = false;
        void load();
      } else if (command === "step" && manual) {
        if (!loaded) {
          if (!loading) void load();
        } else if (stepped < walkSteps) {
          step();
        }
      }
    };

    const onVisibility = () => {
      hidden = document.visibilityState === "hidden";
      holdOrGo();
    };
    document.addEventListener("visibilitychange", onVisibility);
    let observer: IntersectionObserver | null = null;
    const frame = latest.current.frame.current;
    if (frame && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        offscreen = !entries[entries.length - 1].isIntersecting;
        holdOrGo();
      });
      observer.observe(frame);
    }
    // A reader who asks for less motion mid-walk gets the stepping control;
    // nothing starts moving again on its own after that.
    const onMotionPreference = () => {
      if (!reduce.matches || manual) return;
      manual = true;
      stop();
      report();
    };
    reduce.addEventListener?.("change", onMotionPreference);

    report();
    // Wait for an idle slot: the hub loads while the landing is still painting,
    // and the assemble and first steps are heavy. The timeout keeps a busy
    // thread from leaving the hero looking dead.
    let idleHandle: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      if (!manual && !loaded && !loading) void load();
    };
    if (typeof requestIdleCallback === "function") {
      idleHandle = requestIdleCallback(start, { timeout: 1200 });
    } else {
      idleTimer = setTimeout(start, 0);
    }

    return () => {
      generation += 1;
      stop();
      if (idleHandle !== null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleHandle);
      }
      if (idleTimer !== null) clearTimeout(idleTimer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener?.("change", onMotionPreference);
      commandRef.current = () => {};
    };
    // Keyed only on these two: useEmulator returns a new object after every
    // step, so any dep that moves with it would re-run the effect and restart
    // the walk after one step.
  }, [machineLoaded, enabled]);

  return useCallback((command: WalkCommand) => commandRef.current(command), []);
}

/**
 * Runs a box scroll now, or once the reader has been still long enough; the
 * returned function cancels a scroll still waiting.
 */
export type ScrollHold = (move: () => void) => () => void;

/** The hold every surface without a demo walk uses: scroll straight away. */
export const scrollNow: ScrollHold = (move) => {
  move();
  return () => {};
};

/**
 * The demo's box scrolls wait until the reader's wheel and touch input
 * anywhere on the page has been still for a second, so nothing moves under a
 * reader who is scrolling past. Disabled, it never waits.
 */
export function useScrollHold(enabled: boolean): ScrollHold {
  const lastInput = useRef(-Infinity);
  useEffect(() => {
    if (!enabled) return;
    const mark = () => {
      lastInput.current = Date.now();
    };
    const options = { capture: true, passive: true } as const;
    const types = ["wheel", "touchstart", "touchmove"] as const;
    for (const type of types) window.addEventListener(type, mark, options);
    return () => {
      for (const type of types) window.removeEventListener(type, mark, options);
    };
  }, [enabled]);
  return useCallback<ScrollHold>((move) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const attempt = () => {
      const wait = lastInput.current + READER_STILL_MS - Date.now();
      if (wait > 0) {
        timer = setTimeout(attempt, wait);
        return;
      }
      timer = null;
      move();
    };
    attempt();
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
}
