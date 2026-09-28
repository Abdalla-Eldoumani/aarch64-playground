"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { EmulatorBackend } from "@/lib/emulator/backend";

/** Retained console scrollback. The panel renders the whole string as one
 *  text node, so an unbounded buffer turns a print-happy runaway into
 *  seconds of layout jank per heartbeat; 256 KB is thousands of lines. */
export const MAX_CONSOLE_CHARS = 256 * 1024;
/** Visible marker so trimmed output is never mistaken for all of it. */
export const CONSOLE_TRIM_MARKER = "[...earlier output trimmed...]\n";

const MAX_NOTES = 64;

/** Which of the machine's two display streams a call is about. */
export type ConsoleStream = "stdout" | "stderr";

// One encoder/decoder pair for the module: the scrollback is measured in
// machine BYTES (what the emulator counts) while React holds chars, and
// allocating a codec per delta would cost one allocation per step.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/** A bounded append plus the machine bytes the bound dropped off the head,
 *  which is what the caller needs to keep its absolute offsets aligned. */
export interface BoundedAppend {
  text: string;
  droppedBytes: number;
}

/** Append a delta to console scrollback, keeping only the newest
 *  MAX_CONSOLE_CHARS and saying so when older output is dropped. The
 *  marker is peeled off first and re-attached after: it stands for no
 *  machine bytes at all, so a truncation must never cut into it. */
export function appendBoundedTracked(prev: string, delta: string): BoundedAppend {
  const marked = prev.startsWith(CONSOLE_TRIM_MARKER);
  const body = marked ? prev.slice(CONSOLE_TRIM_MARKER.length) : prev;
  const next = body + delta;
  if (next.length <= MAX_CONSOLE_CHARS) {
    return { text: marked ? CONSOLE_TRIM_MARKER + next : next, droppedBytes: 0 };
  }
  const cut = next.length - MAX_CONSOLE_CHARS;
  return {
    text: CONSOLE_TRIM_MARKER + next.slice(cut),
    droppedBytes: byteLength(next.slice(0, cut)),
  };
}

/** Append a delta to console scrollback, keeping only the newest
 *  MAX_CONSOLE_CHARS and saying so when older output is dropped. */
export function appendBounded(prev: string, delta: string): string {
  return appendBoundedTracked(prev, delta).text;
}

/**
 * Where the scrollback sits in the machine's output, in absolute bytes.
 * Known limit: output that is not UTF-8 (a putchar above 0x7F) decodes
 * lossily and can overcount `bytesHeld`; every shipped program prints ASCII.
 */
interface StreamPosition {
  /** The byte offset of scrollback position 0; the trim marker is not counted. */
  seenBase: number;
  /** How many machine bytes the scrollback still shows. */
  bytesHeld: number;
  /** Kept text at the head that stands for no machine bytes (a tool build
   *  reset the counters under it), so an unprint never cuts into it. */
  historyBytes: number;
}

export interface ConsoleOutput {
  stdout: string;
  stderr: string;
  appendStdout: (delta: string) => void;
  appendStderr: (delta: string) => void;
  /** The machine's notes about the program (lib/emulator/clobber-note),
   *  shown under the output and cleared with it. */
  notes: string[];
  appendNotes: (texts: string[]) => void;
  /**
   * Match the scrollback to the machine's output counter. A counter ahead of
   * it only moves the offset (the terminal pane or a clear took those bytes);
   * one that moved back (step back, a restore) removes text down to it, so a
   * re-run does not print twice.
   */
  syncSeen: (stream: ConsoleStream, seen: number) => void;
  /** Empty the scrollback without telling the machine: an editor assemble
   *  and a reset start the student's session over, but the emulator's own
   *  buffers are wiped by the operation that follows. */
  clearScrollback: () => void;
  /** Keep the scrollback on screen but reclassify it as web-only history.
   *  A tool build (`gcc foo.s`) resets the machine's display counters
   *  underneath the editor's console; text that stands for zero machine
   *  bytes re-anchors under the new counters instead of being unprinted
   *  by them. */
  preserveScrollback: () => void;
  /** The console panel's clear control: scrollback and the machine's
   *  pending buffers both. */
  clearConsole: () => void;
  setOutputTap: (tap: ((text: string) => void) | null) => void;
}

/**
 * The console panel's two buffers and the tap that can steal them. While the
 * terminal pane holds the tap, program stdout belongs to xterm; mirroring it
 * into the console doubles every frame.
 */
export function useConsoleOutput(
  backendRef: RefObject<EmulatorBackend | null>,
): ConsoleOutput {
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const outputTapRef = useRef<((text: string) => void) | null>(null);
  // The scrollback is mirrored in refs so an append can move the byte
  // position in the same pass: a functional setState updater runs twice
  // under StrictMode, which would double-count every delta.
  const textRef = useRef<Record<ConsoleStream, string>>({ stdout: "", stderr: "" });
  const posRef = useRef<Record<ConsoleStream, StreamPosition>>({
    stdout: { seenBase: 0, bytesHeld: 0, historyBytes: 0 },
    stderr: { seenBase: 0, bytesHeld: 0, historyBytes: 0 },
  });

  const write = useCallback((stream: ConsoleStream, text: string) => {
    textRef.current[stream] = text;
    if (stream === "stdout") setStdout(text);
    else setStderr(text);
  }, []);

  const append = useCallback(
    (stream: ConsoleStream, delta: string) => {
      const pos = posRef.current[stream];
      const { text, droppedBytes } = appendBoundedTracked(textRef.current[stream], delta);
      // A trim eats the oldest text first, which is the kept history at the
      // head; those bytes never move seenBase, because the machine never
      // wrote them.
      const fromHistory = Math.min(pos.historyBytes, droppedBytes);
      pos.historyBytes -= fromHistory;
      pos.bytesHeld += byteLength(delta) - (droppedBytes - fromHistory);
      pos.seenBase += droppedBytes - fromHistory;
      write(stream, text);
    },
    [write],
  );

  const appendStdout = useCallback(
    (delta: string) => {
      const tap = outputTapRef.current;
      // The terminal pane owns these bytes; the machine still counted them,
      // so the next syncSeen re-anchors the offset over them.
      if (tap) tap(delta);
      else append("stdout", delta);
    },
    [append],
  );

  const appendStderr = useCallback(
    (delta: string) => {
      append("stderr", delta);
    },
    [append],
  );

  // A run notes each register at most once, but terminal runs keep the
  // scrollback, so the list is capped like the text beside it.
  const appendNotes = useCallback((texts: string[]) => {
    setNotes((prev) => [...prev, ...texts].slice(-MAX_NOTES));
  }, []);

  const syncSeen = useCallback(
    (stream: ConsoleStream, seen: number) => {
      const pos = posRef.current[stream];
      if (seen >= pos.seenBase + pos.bytesHeld) {
        // Nothing to unprint. The machine is simply further along than this
        // scrollback: bytes went to the terminal pane, a clear dropped them,
        // or a restored frame's counter sits ahead of what the web holds.
        pos.seenBase = seen - pos.bytesHeld;
        return;
      }
      const target = Math.max(0, seen - pos.seenBase);
      const text = textRef.current[stream];
      const marked = text.startsWith(CONSOLE_TRIM_MARKER);
      const body = marked ? text.slice(CONSOLE_TRIM_MARKER.length) : text;
      // Cut in byte space, because that is the only space the machine's
      // counter speaks, and only in the held tail: preserved history at the
      // head stands for zero machine bytes and is never unprinted. A cut that
      // lands inside a multi-byte character decodes to a replacement char,
      // which is what half a character decodes to, and never throws.
      const encoded = encoder.encode(body);
      const floor = encoded.length - pos.bytesHeld;
      const kept = decoder.decode(encoded.slice(0, floor + target));
      pos.bytesHeld = target;
      // Clamped at zero, the base moves with it: the scrollback holds
      // nothing, so the next byte appended is the machine's next byte.
      // Unclamped this leaves seenBase exactly where it was.
      pos.seenBase = seen - target;
      write(stream, marked ? CONSOLE_TRIM_MARKER + kept : kept);
    },
    [write],
  );

  // The scrollback goes, the machine's counters do not: the next syncSeen
  // re-anchors seenBase over everything that is no longer shown.
  const clearScrollback = useCallback(() => {
    for (const stream of ["stdout", "stderr"] as const) {
      posRef.current[stream].bytesHeld = 0;
      posRef.current[stream].historyBytes = 0;
      write(stream, "");
    }
    setNotes([]);
  }, [write]);

  // The text stays, its byte accounting goes: everything shown becomes
  // history the incoming reset-to-zero counters re-anchor under.
  const preserveScrollback = useCallback(() => {
    for (const stream of ["stdout", "stderr"] as const) {
      const pos = posRef.current[stream];
      const text = textRef.current[stream];
      const marked = text.startsWith(CONSOLE_TRIM_MARKER);
      const body = marked ? text.slice(CONSOLE_TRIM_MARKER.length) : text;
      pos.historyBytes = byteLength(body);
      pos.bytesHeld = 0;
      pos.seenBase = 0;
    }
  }, []);

  const clearConsole = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    clearScrollback();
    void backend.clearConsole();
  }, [backendRef, clearScrollback]);

  const setOutputTap = useCallback((tap: ((text: string) => void) | null) => {
    outputTapRef.current = tap;
  }, []);

  return {
    stdout,
    stderr,
    appendStdout,
    appendStderr,
    notes,
    appendNotes,
    syncSeen,
    clearScrollback,
    preserveScrollback,
    clearConsole,
    setOutputTap,
  };
}
