"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { EmulatorBackend } from "@/lib/emulator/backend";
import { isEmptyLineMap, lineToAddrFromMap, type LineMap } from "@/lib/emulator/line-map";
import { sourceLineToInstrIndex } from "@/lib/emulator/source-lines";

export interface Breakpoints {
  /** The gutter lines carrying a dot. */
  breakpoints: Set<number>;
  toggleBreakpoint: (line: number) => void;
  remapBreakpoints: (remap: (line: number) => number | null) => void;
  clearAllBreakpoints: () => void;
  /** `gdb b label`: arms `addr` and resolves to the breakpoint's number. */
  setBreakpointAddress: (addr: number, label: string) => Promise<number>;
  /** `gdb delete [n]`: breakpoint n, or every one; false when n names none. */
  deleteBreakpoints: (n?: number) => Promise<boolean>;
  /** `gdb b`'s breakpoints as [number, label], lowest number first. */
  gdbBreakpoints: () => [number, string][];
  /** The instruction a line stands for: its own, or the next one after a
   *  label, blank or comment line; null past the last. */
  resolveBreakpointAddr: (line: number) => number | null;
  /**
   * Re-key the gutter dots through a fresh assembly's line map. The CPU
   * deliberately keeps its address set across an assemble, but those
   * addresses belong to the previous assembly of possibly different
   * source, so they are cleared and re-armed from the surviving lines.
   * With `labels`, `gdb b`'s labels are looked up again and re-armed too.
   * Resolves the lines that had no instruction at or after them, in order.
   */
  rekeyAfterAssemble: (params: {
    base: number;
    source: string;
    map: LineMap;
    labels: boolean;
  }) => Promise<number[]>;
}

/**
 * Breakpoints in both of their forms: the editor LINES a student clicked
 * and the CPU ADDRESSES those lines resolve to. The two are not 1:1 (labels,
 * blanks, and comments forward-resolve to the next instruction), so the
 * address set is kept keyed by the lines sharing it, and a CPU breakpoint is
 * cleared only when the last of its dots goes.
 */
export function useBreakpoints({
  backendRef,
  lineMapRef,
  sourceRef,
  programLoadedRef,
  codeBase,
}: {
  backendRef: RefObject<EmulatorBackend | null>;
  lineMapRef: RefObject<LineMap>;
  sourceRef: RefObject<string>;
  programLoadedRef: RefObject<boolean>;
  codeBase: number;
}): Breakpoints {
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  // The same set, readable synchronously: the re-key has to report which
  // dots it dropped, and a state updater runs too late to tell it.
  const linesRef = useRef<Set<number>>(new Set());
  // Which gutter LINES share each armed CPU address.
  const bpLinesByAddrRef = useRef<Map<number, Set<number>>>(new Map());
  // The labels `gdb b` named, by gdb's breakpoint number. gdb keeps a
  // breakpoint across a restart and sets it again by name, so a reset and
  // assemble must not lose them; like gdb, a number is never given twice.
  const labelsRef = useRef<Map<number, string>>(new Map());
  const nextNumberRef = useRef(1);

  const commit = useCallback((next: Set<number>) => {
    linesRef.current = next;
    setBreakpoints(next);
  }, []);

  // Resolve an editor line to an instruction address via the
  // authoritative reverse map: a breakpoint on a label, blank, or
  // comment line lands on the next real instruction. Fall back to index
  // counting only when the map is empty (bare-metal, already 1:1).
  const resolveBreakpointAddr = useCallback(
    (line: number): number | null => {
      const map = lineMapRef.current;
      if (!isEmptyLineMap(map)) {
        return lineToAddrFromMap(line, map);
      }
      const instrIndex = sourceLineToInstrIndex(line, sourceRef.current);
      return instrIndex === null ? null : codeBase + instrIndex * 4;
    },
    [codeBase, lineMapRef, sourceRef],
  );

  const toggleBreakpoint = useCallback(
    (line: number) => {
      const backend = backendRef.current;
      if (!backend) return;
      const next = new Set(linesRef.current);
      const addr = resolveBreakpointAddr(line);
      if (addr === null) {
        // With a program loaded, a line that resolves nowhere cannot stop
        // anything. Before one is, nothing resolves yet: the dot is the
        // student's intent, and the assemble's re-key arms or drops it.
        if (programLoadedRef.current) return;
        if (!next.delete(line)) next.add(line);
        commit(next);
        return;
      }
      const byAddr = bpLinesByAddrRef.current;
      const lines = byAddr.get(addr) ?? new Set<number>();
      if (next.has(line)) {
        next.delete(line);
        lines.delete(line);
        // The CPU breakpoint goes only with the last dot on this
        // instruction.
        if (lines.size === 0) {
          byAddr.delete(addr);
          void backend.clearBreakpoint(addr);
        } else {
          byAddr.set(addr, lines);
        }
      } else {
        next.add(line);
        if (lines.size === 0) void backend.setBreakpoint(addr);
        lines.add(line);
        byAddr.set(addr, lines);
      }
      commit(next);
    },
    [backendRef, resolveBreakpointAddr, programLoadedRef, commit],
  );

  /** Re-number the gutter lines without touching the CPU: the armed
   *  addresses still describe the program currently in memory, and the
   *  assemble that follows an edit clears and re-arms them all anyway. */
  const remapBreakpoints = useCallback(
    (remap: (line: number) => number | null) => {
      const moved = new Map<number, Set<number>>();
      for (const [addr, lines] of bpLinesByAddrRef.current) {
        const next = new Set<number>();
        for (const line of lines) {
          const to = remap(line);
          if (to != null) next.add(to);
        }
        if (next.size > 0) moved.set(addr, next);
      }
      bpLinesByAddrRef.current = moved;
      const next = new Set<number>();
      for (const line of linesRef.current) {
        const to = remap(line);
        if (to != null) next.add(to);
      }
      commit(next);
    },
    [commit],
  );

  /** Drop every breakpoint, gutter and CPU alike: a different program's
   *  dots and addresses must never survive into this one. */
  const clearAllBreakpoints = useCallback(() => {
    bpLinesByAddrRef.current = new Map();
    labelsRef.current = new Map();
    commit(new Set());
    const backend = backendRef.current;
    if (backend) void backend.clearAllBreakpoints();
  }, [backendRef, commit]);

  const setBreakpointAddress = useCallback(
    async (addr: number, label: string) => {
      const n = nextNumberRef.current++;
      labelsRef.current.set(n, label);
      await backendRef.current?.setBreakpoint(addr);
      return n;
    },
    [backendRef],
  );

  const deleteBreakpoints = useCallback(
    async (n?: number) => {
      const labels = labelsRef.current;
      const gone = [...labels].filter(([k]) => n == null || k === n);
      if (n != null && gone.length === 0) return false;
      for (const [k] of gone) labels.delete(k);
      const backend = backendRef.current;
      if (!backend) return true;
      // An instruction a gutter dot or another gdb b still names keeps its stop.
      const kept = new Set(bpLinesByAddrRef.current.keys());
      for (const label of labels.values()) kept.add((await backend.resolveLabel(label)) ?? -1);
      for (const [, label] of gone) {
        const addr = await backend.resolveLabel(label);
        if (addr != null && !kept.has(addr)) void backend.clearBreakpoint(addr);
      }
      return true;
    },
    [backendRef],
  );

  const gdbBreakpoints = useCallback(() => [...labelsRef.current], []);

  const rekeyAfterAssemble = useCallback(
    async ({ base, source, map, labels }: { base: number; source: string; map: LineMap; labels: boolean }) => {
      const backend = backendRef.current;
      if (!backend) return [];
      const mapped = !isEmptyLineMap(map);
      await backend.clearAllBreakpoints();
      // Read after the await: a dot toggled while the clear was in flight
      // belongs to this program too.
      const byAddr = new Map<number, Set<number>>();
      const survivors = new Set<number>();
      const dropped: number[] = [];
      for (const line of linesRef.current) {
        const addr = mapped
          ? lineToAddrFromMap(line, map)
          : (() => {
              const idx = sourceLineToInstrIndex(line, source);
              return idx === null ? null : base + idx * 4;
            })();
        if (addr === null) {
          dropped.push(line);
          continue;
        }
        survivors.add(line);
        const lines = byAddr.get(addr) ?? new Set<number>();
        if (lines.size === 0) void backend.setBreakpoint(addr);
        lines.add(line);
        byAddr.set(addr, lines);
      }
      bpLinesByAddrRef.current = byAddr;
      commit(survivors);
      // Looked up in this program, where the label may have moved; one the
      // program no longer has stays unarmed until it comes back.
      if (labels) {
        for (const label of labelsRef.current.values()) {
          const addr = await backend.resolveLabel(label);
          if (addr != null) void backend.setBreakpoint(addr);
        }
      }
      return dropped.sort((a, b) => a - b);
    },
    [backendRef, commit],
  );

  return {
    breakpoints,
    toggleBreakpoint,
    remapBreakpoints,
    clearAllBreakpoints,
    setBreakpointAddress,
    deleteBreakpoints,
    gdbBreakpoints,
    resolveBreakpointAddr,
    rekeyAfterAssemble,
  };
}
