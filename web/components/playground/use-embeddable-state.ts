"use client";

import { useCallback, useEffect, type RefObject } from "react";
import type { EmulatorState } from "@/lib/emulator/use-emulator";
import type {
  EmbeddablePlaygroundProps,
  EmbeddableState,
} from "@/components/playground/EmbeddablePlayground";

/** The ten outcome fields a host reads: pushed through onStateChange when
 *  one changes, and returned as a getter for a read on demand. */
export function useEmbeddableState({
  emu,
  emuRef,
  onStateChangeRef,
}: {
  emu: EmulatorState;
  emuRef: RefObject<EmulatorState>;
  onStateChangeRef: RefObject<EmbeddablePlaygroundProps["onStateChange"]>;
}) {
  // Mirror exactly the ten outcome fields to the host whenever any of them
  // changes. Keyed only on those fields so unrelated hub churn (breakpoints,
  // disassembly, memory ticks) does not fire the callback.
  useEffect(() => {
    onStateChangeRef.current?.({
      registers: emu.registers,
      sp: emu.sp,
      pc: emu.pc,
      nzcv: emu.nzcv,
      stdout: emu.stdout,
      stderr: emu.stderr,
      exitCode: emu.exitCode,
      isRunning: emu.isRunning,
      isHalted: emu.isHalted,
      error: emu.error,
    });
  }, [
    emu.registers,
    emu.sp,
    emu.pc,
    emu.nzcv,
    emu.stdout,
    emu.stderr,
    emu.exitCode,
    emu.isRunning,
    emu.isHalted,
    emu.error,
    onStateChangeRef,
  ]);

  const currentState = useCallback(
    (): EmbeddableState => ({
      registers: emuRef.current.registers,
      sp: emuRef.current.sp,
      pc: emuRef.current.pc,
      nzcv: emuRef.current.nzcv,
      stdout: emuRef.current.stdout,
      stderr: emuRef.current.stderr,
      exitCode: emuRef.current.exitCode,
      isRunning: emuRef.current.isRunning,
      isHalted: emuRef.current.isHalted,
      error: emuRef.current.error,
    }),
    [emuRef],
  );

  return currentState;
}
