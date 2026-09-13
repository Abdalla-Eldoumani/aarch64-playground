"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { ReplayRing, type ReplayFrame } from "@/lib/emulator/replay";
import type { StateSnapshot } from "@/lib/worker/protocol";

/** The register file as the last snapshot reported it, kept beside the
 *  React state so step/run callbacks can read it without piping values
 *  through a render and racing the snapshot listener. */
export interface LatestSnap {
  registers: string[];
  sp: string;
  fpRegisters: string[];
  vectorRegisters: string[];
  pc: number;
  nzcv: number;
  changedRegs: number[];
  changedFpRegs: number[];
}

export interface CpuView {
  registers: string[];
  sp: string;
  pc: number;
  nzcv: number;
  changedRegs: Set<number>;
  fpRegisters: string[];
  changedFpRegs: Set<number>;
  /** The full 128-bit file behind the v-view; [] on a wasm build without it. */
  vectorRegisters: string[];
  currentLine: number | null;
  currentLineRef: RefObject<number | null>;
  latestSnapRef: RefObject<LatestSnap>;
  /** Bumped whenever the ring mutates; the hub keeps it in the return
   *  memo's deps so consumers re-render on a capture they cannot see
   *  (the ring lives behind a ref whose identity never changes). */
  replayTick: number;
  /** Apply a snapshot's register file to the view, returning the pc as a
   *  number so the caller can resolve it to a source line. */
  applyRegisters: (snap: StateSnapshot) => number;
  /** The marker WITHOUT the ref: the replay seek and reset repaint the
   *  view while leaving the ref describing the live CPU. */
  setCurrentLine: (line: number | null) => void;
  /** The marker WITH the ref: the live machine moved, so the value the
   *  replay capture reads has to move with it. */
  markCurrentLine: (line: number | null) => void;
  pushReplayFrame: (newStepCount: number) => void;
  resetReplayHistory: () => void;
  seekReplay: (frameIndex: number) => void;
  readReplayFrames: () => ReplayFrame[];
}

/**
 * The register/PC/marker view and the replay history behind it. They are
 * one module because they are one set of values seen twice: a capture
 * reads exactly the refs this view maintains, and a seek writes exactly
 * the state it renders. Seeking is visual only: it never touches the CPU, so
 * the next forward step resumes from the live PC.
 */
/**
 * The register view before a machine exists: X0..X30 zeroed, the stack pointer
 * at the top of the stack region, the pc at the code base. Exported because
 * the embed's pre-engage frame paints exactly these values, so the register
 * pane occupies its area before the hub arrives and the grid never moves under
 * the host page.
 */
export const IDLE_CPU_VIEW = {
  registers: Array<string>(31).fill("0x0000000000000000"),
  sp: "0x0000000080000000",
  pc: 0x400000,
  nzcv: 0,
};

export function useCpuView(): CpuView {
  const [registers, setRegisters] = useState<string[]>(
    () => [...IDLE_CPU_VIEW.registers],
  );
  const [sp, setSp] = useState(IDLE_CPU_VIEW.sp);
  const [pc, setPc] = useState(IDLE_CPU_VIEW.pc);
  const [nzcv, setNzcv] = useState(IDLE_CPU_VIEW.nzcv);
  const [changedRegs, setChangedRegs] = useState<Set<number>>(new Set());
  const [fpRegisters, setFpRegisters] = useState<string[]>([]);
  const [changedFpRegs, setChangedFpRegs] = useState<Set<number>>(new Set());
  const [vectorRegisters, setVectorRegisters] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [replayTick, setReplayTick] = useState(0);

  const currentLineRef = useRef<number | null>(null);
  const replayRingRef = useRef<ReplayRing>(new ReplayRing(128));
  const latestSnapRef = useRef<LatestSnap>({
    registers: [],
    sp: "0x0000000080000000",
    fpRegisters: [],
    vectorRegisters: [],
    pc: 0,
    nzcv: 0,
    changedRegs: [],
    changedFpRegs: [],
  });

  const applyRegisters = useCallback((snap: StateSnapshot): number => {
    setRegisters(snap.registers);
    setSp(snap.sp);
    const pcNum = Number(BigInt(snap.pc));
    setPc(pcNum);
    setNzcv(snap.nzcv);
    setChangedRegs(new Set(snap.changedRegs));
    setFpRegisters(snap.fpRegisters);
    setChangedFpRegs(new Set(snap.changedFpRegs));
    setVectorRegisters(snap.vectorRegisters);
    latestSnapRef.current = {
      registers: snap.registers,
      sp: snap.sp,
      fpRegisters: snap.fpRegisters,
      vectorRegisters: snap.vectorRegisters,
      pc: pcNum,
      nzcv: snap.nzcv,
      changedRegs: snap.changedRegs,
      changedFpRegs: snap.changedFpRegs,
    };
    return pcNum;
  }, []);

  const markCurrentLine = useCallback((line: number | null) => {
    setCurrentLine(line);
    currentLineRef.current = line;
  }, []);

  // Called by step / runUntilBreak after the snapshot listener has updated
  // currentLineRef + latestSnapRef.
  const pushReplayFrame = useCallback((newStepCount: number) => {
    const ln = currentLineRef.current;
    const snap = latestSnapRef.current;
    replayRingRef.current.push({
      stepCount: newStepCount,
      registers: snap.registers,
      sp: snap.sp,
      fpRegisters: snap.fpRegisters,
      vectorRegisters: snap.vectorRegisters,
      pc: snap.pc,
      nzcv: snap.nzcv,
      changedRegs: snap.changedRegs,
      changedFpRegs: snap.changedFpRegs,
      currentLine: ln,
    });
    setReplayTick((t) => t + 1);
  }, []);

  const resetReplayHistory = useCallback(() => {
    replayRingRef.current.clear();
    setReplayTick((t) => t + 1);
  }, []);

  const seekReplay = useCallback((frameIndex: number) => {
    const frame = replayRingRef.current.at(frameIndex);
    if (!frame) return;
    setRegisters(frame.registers);
    setSp(frame.sp);
    setFpRegisters(frame.fpRegisters);
    setVectorRegisters(frame.vectorRegisters);
    setPc(frame.pc);
    setNzcv(frame.nzcv);
    setChangedRegs(new Set(frame.changedRegs));
    setChangedFpRegs(new Set(frame.changedFpRegs));
    setCurrentLine(frame.currentLine);
  }, []);

  const readReplayFrames = useCallback(() => replayRingRef.current.range(), []);

  return {
    registers,
    sp,
    pc,
    nzcv,
    changedRegs,
    fpRegisters,
    changedFpRegs,
    vectorRegisters,
    currentLine,
    currentLineRef,
    latestSnapRef,
    replayTick,
    applyRegisters,
    setCurrentLine,
    markCurrentLine,
    pushReplayFrame,
    resetReplayHistory,
    seekReplay,
    readReplayFrames,
  };
}
