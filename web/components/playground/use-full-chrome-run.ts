"use client";

import { useCallback, useEffect, useRef } from "react";
import type { useLaunchMode } from "@/lib/playground/use-launch-mode";
import type { useTerminalDrive } from "@/lib/playground/use-terminal-drive";
import { sameWorkspace, type Workspace } from "@/lib/playground/file-map";
import type { FullChromeSurfaceProps } from "@/components/playground/FullChromeSurface";
import type { RightTab } from "@/components/playground/RightTabs";

type Drive = ReturnType<typeof useTerminalDrive>;

/** The run press and its relatives: assemble and run, the terminal launch,
 *  and reset that starts the same program over. */
export function useFullChromeRun({
  emu,
  emuRef,
  source,
  extraFiles,
  argsText,
  assembleWithHistory,
  requestPane,
  requestTerminalRun,
  resetMachine,
  foregroundLive,
  launchMode,
}: Pick<FullChromeSurfaceProps, "emu" | "emuRef" | "source" | "extraFiles" | "argsText"> & {
  assembleWithHistory: FullChromeSurfaceProps["assemble"];
  requestPane: (pane: RightTab) => void;
  requestTerminalRun: Drive["requestTerminalRun"];
  resetMachine: Drive["resetMachine"];
  foregroundLive: Drive["foregroundLive"];
  launchMode: ReturnType<typeof useLaunchMode>["mode"];
}) {
  // Assemble, then hand the terminal pane over. The assemble must land first,
  // or the drive's programLoaded check ends the new session at once.
  const launchInteractive = useCallback(async () => {
    const ok = await assembleWithHistory();
    // The failure already renders in Controls' error box, and the pane is
    // left alone: a failed assemble must not wipe the terminal.
    if (!ok) return;
    requestPane("term");
    requestTerminalRun();
  }, [assembleWithHistory, requestPane, requestTerminalRun]);

  // Ctrl+Enter: assemble, then run it the way a run press would. Terminal
  // mode's one-action launch already is exactly that.
  const assembleAndRun = useCallback(async () => {
    if (launchMode === "terminal") {
      await launchInteractive();
      return;
    }
    if (await assembleWithHistory()) emuRef.current.run();
  }, [launchMode, launchInteractive, assembleWithHistory, emuRef]);

  // The workspace and args the machine last assembled from here, so a run
  // press can tell the student's edits from the program that is loaded.
  const loadedRef = useRef<{ workspace: Workspace; args: string } | null>(null);
  const noteAssembled = () => {
    loadedRef.current = { workspace: { main: source, extras: extraFiles }, args: argsText };
  };

  // Run starts the program on screen from the top, as a lesson's run does,
  // when nothing is loaded, the program finished, or the code, files or args
  // changed since the last assemble; only an unchanged program that paused
  // carries on. Assemble alone loads without running. In terminal mode a
  // loaded program is handed the pane: the tab switches, and the attach
  // effect starts the drive once the pane's io registration lands.
  const handleRun = useCallback(() => {
    if (emu.isAssembling || emu.isRunning) return;
    const loaded = loadedRef.current;
    const edited =
      loaded !== null &&
      (loaded.args !== argsText ||
        !sameWorkspace(loaded.workspace, { main: source, extras: extraFiles }));
    if (!emu.programLoaded || emu.isHalted || edited) {
      void assembleAndRun();
      return;
    }
    if (launchMode === "terminal") {
      requestPane("term");
      requestTerminalRun();
      return;
    }
    emu.run();
  }, [emu, argsText, source, extraFiles, assembleAndRun, launchMode, requestPane, requestTerminalRun]);
  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  // Reset starts the same program over: an unedited workspace is assembled
  // again at once so breakpoints stay armed and run and step stay live. An
  // edited one waits for the student. A live terminal session only stops,
  // since a reassemble under it would start the program with no key pressed.
  const restartProgram = useCallback(() => {
    const wasLoaded = emuRef.current.programLoaded;
    resetMachine();
    const loaded = loadedRef.current;
    if (!wasLoaded || foregroundLive || !loaded) return;
    if (sameWorkspace(loaded.workspace, { main: source, extras: extraFiles })) {
      void assembleWithHistory();
    }
  }, [emuRef, resetMachine, foregroundLive, source, extraFiles, assembleWithHistory]);

  // Whether the composite launch has somewhere to land: only the terminal
  // mode owns the pane at run press, and only this surface has a pane.
  const launchable = launchMode === "terminal";

  return {
    launchInteractive,
    assembleAndRun,
    loadedRef,
    noteAssembled,
    handleRun,
    handleRunRef,
    restartProgram,
    launchable,
  };
}
