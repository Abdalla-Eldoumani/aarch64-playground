"use client";

import type { RefObject } from "react";
import type { parseFrameSlots } from "@/lib/emulator/frame-labels";
import { MAX_VFS_BYTES, checkUploadSize } from "@/lib/playground/upload-guard";
import type { useLaunchMode } from "@/lib/playground/use-launch-mode";
import type { useTerminalDrive } from "@/lib/playground/use-terminal-drive";
import type { createTerminalContext } from "@/lib/playground/terminal-context";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import type { DebugPanes } from "@/components/playground/RightTabs";
import {
  BaseConverter,
  MemoryPanel,
  MemoryWatches,
  SavesPanel,
  StackPanel,
  TerminalPane,
  WatchPanel,
} from "@/components/playground/lazy-panels";
import type { FullChromeSurfaceProps } from "@/components/playground/FullChromeSurface";
import type { useFullChromeRun } from "@/components/playground/use-full-chrome-run";
import type { useToast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

type Drive = ReturnType<typeof useTerminalDrive>;

/** The eight machine panes, built during the surface's render. Not a
 *  component, so the element tree stays as it was; named as a hook, though
 *  it calls none, because it takes the surface's refs. */
export function useDebugPanes({
  emu,
  source,
  argsText,
  loadProgram,
  stageVfsFile,
  fpValue,
  frameSlots,
  launchMode,
  foregroundLive,
  terminalOwnedFrom,
  clearConsoleAll,
  registerTermIO,
  buildTerminalContext,
  terminalUploadRef,
  loadedRef,
  toast,
}: Pick<FullChromeSurfaceProps, "emu" | "source" | "argsText" | "loadProgram" | "stageVfsFile"> & {
  fpValue: number;
  frameSlots: ReturnType<typeof parseFrameSlots>;
  launchMode: ReturnType<typeof useLaunchMode>["mode"];
  foregroundLive: Drive["foregroundLive"];
  terminalOwnedFrom: Drive["terminalOwnedFrom"];
  clearConsoleAll: Drive["clearConsoleAll"];
  registerTermIO: Drive["registerTermIO"];
  buildTerminalContext: () => ReturnType<typeof createTerminalContext>;
  terminalUploadRef: RefObject<HTMLInputElement | null>;
  loadedRef: ReturnType<typeof useFullChromeRun>["loadedRef"];
  toast: ReturnType<typeof useToast>;
}): DebugPanes {
  const memoryBlock = (
    <ErrorBoundary label="memory">
      <MemoryPanel
        getMemory={emu.getMemory}
        dirtyAddrs={emu.dirtyAddrs}
        regions={emu.memoryRegions}
        sp={emu.sp}
      />
    </ErrorBoundary>
  );
  const stackBlock = (
    <ErrorBoundary label="stack">
      <StackPanel
        sp={emu.sp}
        getMemory={emu.getMemory}
        fp={fpValue}
        frameSlots={frameSlots}
      />
    </ErrorBoundary>
  );
  const consoleBlock = (
    <ErrorBoundary label="console">
      <ConsolePanel
        stdout={emu.stdout}
        stderr={emu.stderr}
        notes={emu.notes}
        blocked={emu.blocked}
        ownedByTerminal={foregroundLive || launchMode === "terminal"}
        terminalOwnedFrom={terminalOwnedFrom}
        exitCode={emu.exitCode}
        vfsFiles={emu.vfsFiles}
        pushStdin={emu.pushStdin}
        onInputSent={emu.resumeAfterInput}
        closeStdin={emu.closeStdin}
        uploadVfsFile={stageVfsFile}
        clearConsole={clearConsoleAll}
      />
    </ErrorBoundary>
  );
  const terminalBlock = (
    <ErrorBoundary label="terminal">
      <div className="h-full relative">
        <input
          ref={terminalUploadRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const sizeError = checkUploadSize(f.size, MAX_VFS_BYTES, "file");
            if (sizeError) {
              toast.error(sizeError);
              e.target.value = "";
              return;
            }
            f.arrayBuffer().then((buf) => {
              stageVfsFile(f.name, new Uint8Array(buf));
            });
            e.target.value = "";
          }}
        />
        <TerminalPane
          buildContext={buildTerminalContext}
          onUploadRequest={() => terminalUploadRef.current?.click()}
          onRegisterIO={registerTermIO}
        />
      </div>
    </ErrorBoundary>
  );
  const watchBlock = (
    <ErrorBoundary label="watches">
      <WatchPanel
        registers={emu.registers}
        sp={emu.sp}
        pc={emu.pc}
        frameSlots={frameSlots}
        getMemory={emu.getMemory}
        getMemoryMapped={emu.getMemoryMapped}
        source={source}
        resolveLabel={emu.resolveLabel}
        program={emu.instructions}
      />
    </ErrorBoundary>
  );
  const memWatchBlock = (
    <ErrorBoundary label="memory watch">
      <MemoryWatches getMemory={emu.getMemory} />
    </ErrorBoundary>
  );
  const converterBlock = (
    <ErrorBoundary label="converter">
      <BaseConverter />
    </ErrorBoundary>
  );
  const savesBlock = (
    <ErrorBoundary label="saves">
      <SavesPanel
        savedStates={emu.savedStates}
        onSaveState={emu.saveState}
        onLoadState={emu.loadState}
        onDeleteState={emu.deleteState}
        source={source}
        args={argsText}
        stepCount={emu.stepCount}
        onLoadProgram={loadProgram}
        onRestoreBookmark={async (params) => {
          const verdict = await emu.restoreBookmark(params);
          // The restore assembled the bookmark's own program, so a run press
          // carries on from the restored step instead of starting over.
          if (verdict.success) {
            loadedRef.current = {
              workspace: { main: params.source, extras: [] },
              args: params.args ?? "",
            };
          }
          return verdict;
        }}
      />
    </ErrorBoundary>
  );

  // The eight machine views as one bundle: the tab strip and the phone
  // layout each render the same set, so neither has to name them one by one.
  const panes: DebugPanes = {
    memory: memoryBlock,
    stack: stackBlock,
    console: consoleBlock,
    terminal: terminalBlock,
    watches: watchBlock,
    converter: converterBlock,
    memwatch: memWatchBlock,
    saves: savesBlock,
  };

  return panes;
}
