"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  EXAMPLE_INTERACTIVE,
  decodeLaunch,
  legacyModeArgsFor,
  modeArgsFor,
  type LaunchMode,
} from "@/lib/playground/playground-handoff";
import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

// Persisted beside the files strip so a reloaded workspace remembers which
// surface owns the pane at run press. The key name predates the mode having
// two spellings: it still holds the "1" / "0" a returning student's browser
// wrote, which decodeLaunch reads unchanged.
const LAUNCH_MODE_KEY = "aarch64-playground:terminal-program";

export interface LaunchModeParams {
  /** The args box, which the mode owns for the examples that wear a different
   *  face per surface, until the student edits it. */
  args: string;
  setArgs: (next: string) => void;
}

export interface LaunchModeControl {
  /** Who owns the pane when this program's run is pressed. */
  mode: LaunchMode;
  /** The same value as a ref, for effects that must not re-subscribe. */
  modeRef: RefObject<LaunchMode>;
  /** Whether this program has a real answer to the console-or-terminal
   *  question, which is what the run-mode control is offered for. */
  offersControl: boolean;
  /** The run-mode control's own handler: flips the mode and, for the stems
   *  that wear two faces, the args box with it. */
  changeMode: (next: LaunchMode) => void;
  /** A program handoff adopting its launch: returns the value the args box
   *  should take, which the mode owns for a two-faced example. */
  adoptLaunch: (
    stem: string | null,
    launch: LaunchMode,
    payloadArgs: string,
  ) => string;
  /** A text-only swap or an import replaces the program without a payload:
   *  the mode and the stem both belonged to the program that set them, and a
   *  stale mode would send an unrelated program's run to the pane. */
  reset: () => void;
}

/**
 * Who owns the terminal pane at the next run press, and the args box that
 * follows it. The mode persists across reloads; the example stem it belongs
 * to does not, because a hand-written buffer has no stem and must see the
 * plain header band.
 */
export function useLaunchMode({ args, setArgs }: LaunchModeParams): LaunchModeControl {
  const [mode, setModeState] = useState<LaunchMode>(() =>
    decodeLaunch(safeGetItem(LAUNCH_MODE_KEY)),
  );
  const modeRef = useRef<LaunchMode>("console");
  const setMode = useCallback((next: LaunchMode) => {
    modeRef.current = next;
    setModeState(next);
    // storage full or blocked: the mode just won't survive a reload
    safeSetItem(LAUNCH_MODE_KEY, next);
  }, []);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // The example this workspace came from, when it came from one.
  const [stem, setStem] = useState<string | null>(null);
  // The args the loaded payload carried. With the mode's two seeded forms it
  // is the third value that still counts as a clean args box, so a
  // fixture-seeded program keeps following the mode until the student types
  // something of their own.
  const payloadArgsRef = useRef("");

  // The run-mode control moves the args box too, for the examples that wear
  // a different face per surface. It stops at the student: a box edited to
  // anything the app did not put there is theirs, in either mode.
  const changeMode = useCallback(
    (next: LaunchMode) => {
      setMode(next);
      const seeded = modeArgsFor(stem, next);
      if (seeded == null) return;
      const clean =
        args === "" ||
        args === modeArgsFor(stem, "console") ||
        args === payloadArgsRef.current;
      if (clean) setArgs(seeded);
    },
    [args, setArgs, stem, setMode],
  );

  // The console face used to seed `./<stem> console`; the emulator now owns
  // argv[0], so that stored box would hand the program an extra argument and
  // land it on its usage path. Migrate that exact string, whichever ingress
  // restored it, and leave every other box alone.
  useEffect(() => {
    if (args !== "" && args === legacyModeArgsFor(stem)) {
      setArgs(modeArgsFor(stem, "console") ?? "");
    }
  }, [args, stem, setArgs]);

  const adoptLaunch = useCallback(
    (nextStem: string | null, launch: LaunchMode, payloadArgs: string) => {
      setMode(launch);
      setStem(nextStem);
      // A mode-args example wears a different face per surface, so the mode
      // owns its args box: the console face takes the token, the terminal
      // face takes none. That overrides the fixture args the payload carries
      // (temp-convert declares both), and the payload's own value is
      // remembered as one of the forms a still-clean box may hold.
      payloadArgsRef.current = payloadArgs;
      return modeArgsFor(nextStem, launch) ?? payloadArgs;
    },
    [setMode],
  );

  const reset = useCallback(() => {
    setMode("console");
    setStem(null);
  }, [setMode]);

  return {
    mode,
    modeRef,
    offersControl: stem !== null && EXAMPLE_INTERACTIVE[stem] === true,
    changeMode,
    adoptLaunch,
    reset,
  };
}
