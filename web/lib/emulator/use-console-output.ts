"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { EmulatorBackend } from "@/lib/emulator/backend";

/** Retained console scrollback. The panel renders the whole string as one
 *  text node, so an unbounded buffer turns a print-happy runaway into
 *  seconds of layout jank per heartbeat; 256 KB is thousands of lines. */
export const MAX_CONSOLE_CHARS = 256 * 1024;
/** Visible marker so trimmed output is never mistaken for all of it. */
export const CONSOLE_TRIM_MARKER = "[...earlier output trimmed...]\n";

/** Append a delta to console scrollback, keeping only the newest
 *  MAX_CONSOLE_CHARS and saying so when older output is dropped. */
export function appendBounded(prev: string, delta: string): string {
  const next = prev + delta;
  if (next.length <= MAX_CONSOLE_CHARS) return next;
  return CONSOLE_TRIM_MARKER + next.slice(next.length - MAX_CONSOLE_CHARS);
}

export interface ConsoleOutput {
  stdout: string;
  stderr: string;
  appendStdout: (delta: string) => void;
  appendStderr: (delta: string) => void;
  /** Empty the scrollback without telling the machine: an editor assemble
   *  and a reset start the student's session over, but the emulator's own
   *  buffers are wiped by the operation that follows. */
  clearScrollback: () => void;
  /** The console panel's clear control: scrollback and the machine's
   *  pending buffers both. */
  clearConsole: () => void;
  setOutputTap: (tap: ((text: string) => void) | null) => void;
}

/**
 * The console panel's two buffers and the tap that can steal them. While
 * the terminal pane holds the tap, program stdout belongs to xterm --
 * mirroring it into the console doubled every frame.
 */
export function useConsoleOutput(
  backendRef: RefObject<EmulatorBackend | null>,
): ConsoleOutput {
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const outputTapRef = useRef<((text: string) => void) | null>(null);

  const appendStdout = useCallback((delta: string) => {
    const tap = outputTapRef.current;
    if (tap) tap(delta);
    else setStdout((prev) => appendBounded(prev, delta));
  }, []);

  const appendStderr = useCallback((delta: string) => {
    setStderr((prev) => appendBounded(prev, delta));
  }, []);

  const clearScrollback = useCallback(() => {
    setStdout("");
    setStderr("");
  }, []);

  const clearConsole = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    setStdout("");
    setStderr("");
    void backend.clearConsole();
  }, [backendRef]);

  const setOutputTap = useCallback((tap: ((text: string) => void) | null) => {
    outputTapRef.current = tap;
  }, []);

  return {
    stdout,
    stderr,
    appendStdout,
    appendStderr,
    clearScrollback,
    clearConsole,
    setOutputTap,
  };
}
