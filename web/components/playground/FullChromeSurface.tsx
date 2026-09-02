"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmulatorState } from "@/lib/emulator/use-emulator";
import { useBreakpoint } from "@/lib/hooks/use-breakpoint";
import type { useRecentPrograms } from "@/lib/playground/auto-save";
import type { HandoffPayload } from "@/lib/playground/playground-handoff";
import { parseFrameSlots } from "@/lib/emulator/frame-labels";
import { formatByte, formatWord64 } from "@/lib/emulator/format-hex";
import type { DiagnosticBundle } from "@/lib/playground/diagnostic-bundle";
import { formatAsm } from "@/lib/asm/asm-formatter";
import { MAX_VFS_BYTES, checkUploadSize } from "@/lib/playground/upload-guard";
import { useLaunchMode } from "@/lib/playground/use-launch-mode";
import type { WorkingSet } from "@/lib/playground/use-working-set";
import { useTerminalDrive } from "@/lib/playground/use-terminal-drive";
import { createTerminalContext } from "@/lib/playground/terminal-context";
import {
  describeTarget,
  getImportTarget,
  type ImportTarget,
} from "@/lib/hooks/use-import-target";
import { Editor } from "@/components/playground/lazy-editor";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import { Controls } from "@/components/playground/Controls";
import { DecodeStrip } from "@/components/panels/DecodeStrip";
import { FirstRunState } from "@/components/playground/FirstRunState";
import { FullLayout } from "@/components/playground/FullLayout";
import { PlaygroundHeaderBand } from "@/components/playground/PlaygroundHeaderBand";
import {
  RightTabs,
  type DebugPanes,
  type RightTab,
} from "@/components/playground/RightTabs";
import {
  MultiFileTabs,
  combineSources,
  type SourceFile,
} from "@/components/playground/MultiFileTabs";
import type { SourceFilesBackup } from "@/lib/hooks/use-source-files";
import {
  BaseConverter,
  InstructionView,
  MemoryPanel,
  MemoryWatches,
  ReplayScrubber,
  SavesPanel,
  StackPanel,
  TerminalPane,
  TutorialRunner,
  WatchPanel,
} from "@/components/playground/lazy-panels";
import {
  breakpointsForFile,
  combinedLineFor,
  diagnosticsForFile,
  errorWithFileName,
  planBreakpointRemap,
  resolveLine,
  validateFileName,
  workspaceShape,
  type Workspace,
} from "@/lib/playground/file-map";
import { useToast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/**
 * The handful of full-chrome actions the shell defers to. The shell owns the
 * program buffer and the imperative handle, but some of what it does to them
 * -- adopting a payload's launch, dropping the console watermark, resetting
 * through a live terminal session -- exists only on this surface, and this
 * surface loads lazily. So it publishes them upward when it mounts and the
 * shell reads them through a ref, falling back to the plain machine where they
 * are absent (embed and checker, which never load this module).
 */
export type FullChromeBridge = {
  /** A program handoff landed: adopt its launch and return the value the args
   *  box should take, drop the previous session's watermark, and set the
   *  shared-program banner. */
  onProgramLoaded: (payload: HandoffPayload) => string;
  /** An assemble is about to reset the machine and empty the console. */
  onAssemble: () => void;
  /** The buffer was replaced without a payload, so the launch mode it
   *  belonged to goes with it. */
  onSourceReplaced: () => void;
  /** Reset through the drive, so a live foreground session stands down. */
  resetMachine: () => void;
  /** Run, which in terminal mode hands the pane over instead. */
  run: () => void;
  /** Whether the composite launch has somewhere to land. */
  launchable: () => boolean;
  launchInteractive: () => void;
  openConverter: () => void;
  openTour: () => void;
};

export interface FullChromeSurfaceProps {
  /** The hub, and the latest-value ref every callback reads it through: the
   *  hub is a new object after every snapshot. */
  emu: EmulatorState;
  emuRef: React.RefObject<EmulatorState>;
  source: string;
  setSource: (next: string) => void;
  sourceRef: React.RefObject<string>;
  extraFiles: SourceFile[];
  setExtraFiles: (next: SourceFile[]) => void;
  extraFilesRef: React.RefObject<SourceFile[]>;
  filesBackup: SourceFilesBackup;
  activeFile: number;
  setActiveFile: (next: number) => void;
  argsText: string;
  setArgsText: (next: string) => void;
  setCursor: (next: { line: number; column: number }) => void;
  lintWarnings: Array<{ line: number; message: string }>;
  errorFocus: { line: number; nonce: number } | null;
  /** The workspace as the machine last saw it; every combined-string line the
   *  machine reports is numbered against it. */
  assembledLayout: { main: string; extras: SourceFile[] } | null;
  /** The shell's assemble, which pins that layout and pushes to recents. */
  assemble: () => Promise<boolean>;
  loadProgram: (payload: HandoffPayload) => void;
  recent: ReturnType<typeof useRecentPrograms>;
  applySeeds: WorkingSet["applySeeds"];
  stageVfsFile: WorkingSet["stageVfsFile"];
  removeVfsFile: WorkingSet["removeVfsFile"];
  /** A share-link boot: raises the banner over the header band. */
  fromShare?: boolean;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenShareDialog?: () => void;
  onToggleTheme?: () => void;
  /** Published on mount, cleared on unmount. */
  registerBridge: (bridge: FullChromeBridge | null) => void;
}

/**
 * The playground's own half of the shared shell: the header band, the files
 * strip, the three-column resizable layout with its eight machine views, the
 * controls, the tour -- and the two hooks only this surface has a use for, the
 * launch mode and the terminal drive.
 *
 * Its own module, reached through dynamic(), because everything named above is
 * full-chrome only while the shell is what the landing hero mounts: reaching
 * it statically put react-resizable-panels, the terminal drive, the launch
 * tables and (through those) lz-string in the landing's script list for a
 * surface the landing never renders.
 *
 * The shell hands its state down and reads the few full-only actions back
 * through the bridge. The hub crosses exactly one boundary, into here, because
 * the two hooks below cannot be called anywhere else.
 */
export function FullChromeSurface({
  emu,
  emuRef,
  source,
  setSource,
  sourceRef,
  extraFiles,
  setExtraFiles,
  extraFilesRef,
  filesBackup,
  activeFile,
  setActiveFile,
  argsText,
  setArgsText,
  setCursor,
  lintWarnings,
  errorFocus,
  assembledLayout,
  assemble: assembleWithHistory,
  loadProgram,
  recent,
  applySeeds,
  stageVfsFile,
  removeVfsFile,
  fromShare,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onOpenShareDialog,
  onToggleTheme,
  registerBridge,
}: FullChromeSurfaceProps) {
  const toast = useToast();
  const bp = useBreakpoint();
  const [activeTab, setActiveTab] = useState<RightTab>("memory");
  // Mirrors the palette's converter action into the phone layout, where the
  // desktop tab state has nothing to show.
  const [paneRequest, setPaneRequest] = useState<{ pane: string; nonce: number } | null>(null);
  // Bringing a pane forward takes both: the desktop tab state, and the nonce
  // the phone layout's pane switcher watches.
  const requestPane = useCallback((pane: RightTab) => {
    setActiveTab(pane);
    setPaneRequest({ pane, nonce: Date.now() });
  }, []);
  const [shareBanner, setShareBanner] = useState(Boolean(fromShare));
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // Who owns the pane when this program's run is pressed: a live terminal
  // session (the visualizer example, or the student's own choice) or the
  // classic console flow. The hook owns the persistence, the example stem
  // the mode belongs to, and the args box the two-faced examples move.
  const {
    mode: launchMode,
    modeRef: launchModeRef,
    offersControl: offersRunMode,
    changeMode: handleLaunchModeChange,
    adoptLaunch,
    reset: resetLaunch,
  } = useLaunchMode({ args: argsText, setArgs: setArgsText });
  // A share-link boot carries its own workspace: replace the persisted
  // files strip once, before the first assemble can mix the two.
  const importTarget = getImportTarget(activeFile);

  const handleImport = useCallback(
    (target: ImportTarget, body: string) => {
      resetLaunch();
      switch (target.kind) {
        case "main":
          setSource(body);
          toast.show("imported into main.asm");
          return;
        case "extra": {
          const idx = target.index;
          setExtraFiles(
            extraFiles.map((f, i) => (i === idx ? { ...f, body } : f)),
          );
          toast.show(`imported into ${describeTarget(target, extraFiles)}`);
          return;
        }
      }
    },
    [extraFiles, setExtraFiles, setSource, toast, resetLaunch],
  );

  // Multi-select import: a file named main.asm / main.s replaces the main
  // buffer; every other file becomes (or refreshes) a named tab, so a
  // whole multi-file program lands in one gesture.
  const handleImportMany = useCallback(
    (files: { name: string; body: string }[]) => {
      resetLaunch();
      const mainIdx = files.findIndex((f) => /^main\.(asm|s)$/i.test(f.name));
      if (mainIdx >= 0) setSource(files[mainIdx].body);
      const rest = files.filter((_, i) => i !== mainIdx);
      const next = [...extraFiles];
      for (const f of rest) {
        const at = next.findIndex((x) => x.name === f.name);
        if (at >= 0) next[at] = { name: f.name, body: f.body };
        else next.push({ name: f.name, body: f.body });
      }
      setExtraFiles(next);
      toast.show(`imported ${files.length} files`);
    },
    [extraFiles, setExtraFiles, setSource, toast, resetLaunch],
  );
  // The terminal pane's foreground sessions: the shared drive, the console
  // watermark a session leaves behind, and the two rising edges (a blocked
  // read, a raw-mode program) that decide which pane comes forward.
  const {
    terminalOwnedFrom,
    foregroundLive,
    dropTerminalWatermark,
    resetMachine,
    clearConsoleAll,
    requestTerminalRun,
    registerTermIO,
    driveForeground,
  } = useTerminalDrive({
    machine: emuRef,
    wantsTerminal: emu.wantsTerminal,
    blocked: emu.blocked,
    stdout: emu.stdout,
    launchModeRef,
    terminalTabActive: activeTab === "term",
    requestPane,
  });
  // The one-action interactive launch: assemble, then hand the pane over.
  // Reached from the palette's launch action and from a run press in
  // terminal mode with nothing assembled -- the state that used to be a
  // silent no-op. It bypasses handleRun's finished-screen guard on
  // purpose: that guard protects a completed program's output, and this
  // just replaced the program with a freshly assembled one. The order
  // matters -- the assemble must land before the nonce, or the drive's
  // programLoaded standdown tears the session down at once.
  const launchInteractive = useCallback(async () => {
    const ok = await assembleWithHistory();
    // The failure already renders in Controls' error box, and the pane is
    // left alone: a failed assemble must not wipe the terminal.
    if (!ok) return;
    requestPane("term");
    requestTerminalRun();
  }, [assembleWithHistory, requestPane, requestTerminalRun]);
  // Run in terminal mode: hand the program the pane up front -- switch
  // the tab, then let the attach effect below start the drive once the
  // pane's io registration lands (the pane mounts lazily on the tab
  // switch, so the drive cannot start synchronously here).
  const handleRun = useCallback(() => {
    if (launchMode === "terminal") {
      // Cold load: nothing is assembled, so there is no screen to protect
      // and nothing to hand over yet. This was a silent no-op; in terminal
      // mode it becomes the one-action launch the mode promises. The run
      // button is disabled here, so this is the F5 / palette / handle path.
      if (!emu.programLoaded) {
        void launchInteractive();
        return;
      }
      // The terminal takeover WIPES the pane, so a finished or already
      // running program is left alone: without this, F5 and the palette
      // cleared a finished program's output and printed an exit line onto
      // an empty screen. An assembled program hands over without
      // re-assembling -- the same run press it has always been.
      if (emu.isHalted || emu.isRunning) return;
      requestPane("term");
      requestTerminalRun();
      return;
    }
    emu.run();
  }, [launchMode, emu, launchInteractive, requestPane, requestTerminalRun]);
  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  // Whether the composite launch has somewhere to land: only the terminal
  // mode owns the pane at run press, and only this surface has a pane.
  const launchable = launchMode === "terminal";

  // Published upward once, as a stable object reading the live values through
  // a ref: the shell built the callbacks that call these before this module
  // had loaded.
  const liveRef = useRef({
    adoptLaunch,
    dropTerminalWatermark,
    resetLaunch,
    resetMachine,
    launchable,
    launchInteractive,
  });
  useEffect(() => {
    liveRef.current = {
      adoptLaunch,
      dropTerminalWatermark,
      resetLaunch,
      resetMachine,
      launchable,
      launchInteractive,
    };
  });
  useEffect(() => {
    const bridge: FullChromeBridge = {
      onProgramLoaded: (payload) => {
        const launchOwner = payload.launch === "terminal" ? "terminal" : "console";
        // Adopting the launch settles the args box too: a two-faced example's
        // mode owns it, and only otherwise does the payload's own value stand.
        const nextArgs = liveRef.current.adoptLaunch(
          payload.stem ?? null,
          launchOwner,
          payload.args ?? "",
        );
        // A new program starts on a fresh console; no session owns it yet.
        liveRef.current.dropTerminalWatermark();
        setShareBanner(Boolean(payload.fromShare));
        return nextArgs;
      },
      onAssemble: () => liveRef.current.dropTerminalWatermark(),
      onSourceReplaced: () => liveRef.current.resetLaunch(),
      resetMachine: () => liveRef.current.resetMachine(),
      run: () => handleRunRef.current(),
      launchable: () => liveRef.current.launchable,
      launchInteractive: () => void liveRef.current.launchInteractive(),
      openConverter: () => requestPane("convert"),
      openTour: () => setTutorialOpen(true),
    };
    registerBridge(bridge);
    return () => registerBridge(null);
  }, [registerBridge, requestPane]);

  // Editor wiring: main buffer vs an extra file tab.
  const isMain = activeFile === -1;
  const editorValue = isMain ? source : extraFiles[activeFile]?.body ?? "";
  const onEditorChange = useCallback(
    (next: string) => {
      if (isMain) {
        setSource(next);
      } else {
        setExtraFiles(
          extraFiles.map((f, i) => (i === activeFile ? { ...f, body: next } : f)),
        );
      }
    },
    [isMain, activeFile, extraFiles, setExtraFiles, setSource],
  );
  // Machine-produced lines resolve against the ASSEMBLED workspace; only the
  // gutter (which the student clicks in the buffer on screen) uses the live
  // one. Before the first assemble there is nothing pinned, so both fall back
  // to what is on screen.
  const machineMain = assembledLayout?.main ?? source;
  const machineExtras = assembledLayout?.extras ?? extraFiles;

  // The decode strip reads the line under the pc out of the source it is
  // handed, and `emu.currentLine` is a COMBINED-string line. Handing it
  // main.asm alone indexed past the end for any pc inside a helper, so the
  // gloss fell to its placeholder for the whole of a multi-file program --
  // and helper `define` aliases never labelled a register.
  // Keyed on the pin alone, so the concatenation happens once per assemble
  // rather than on every keystroke of a large workspace. Nothing is pinned
  // before the first assemble, and with no program there is no line to gloss.
  const pinnedCombined = useMemo(() => {
    if (!assembledLayout) return null;
    return assembledLayout.extras.length > 0
      ? combineSources(assembledLayout.main, assembledLayout.extras)
      : assembledLayout.main;
  }, [assembledLayout]);
  const decodeSource = pinnedCombined ?? source;

  const frameSlots = useMemo(() => parseFrameSlots(source), [source]);
  const fpValue = useMemo(() => {
    const raw = emu.registers[29];
    if (!raw) return 0;
    const clean = raw.startsWith("0x") ? raw.slice(2) : raw;
    return parseInt(clean, 16) || 0;
  }, [emu.registers]);

  // Hidden file picker the terminal's `upload` command triggers.
  const terminalUploadRef = useRef<HTMLInputElement>(null);
  // Per-file views of the combined-line diagnostics: the editor shows one
  // buffer at a time, so markers, the current-line highlight, and gutter
  // breakpoints each translate to the active file's local lines (and hide
  // when they belong to another file).
  const activeErrors = useMemo(
    () => diagnosticsForFile(emu.assemblyErrors, machineMain, machineExtras, activeFile),
    [emu.assemblyErrors, machineMain, machineExtras, activeFile],
  );
  const activeLint = useMemo(
    () => diagnosticsForFile(lintWarnings, source, extraFiles, activeFile),
    [lintWarnings, source, extraFiles, activeFile],
  );
  const activeCurrentLine = useMemo(() => {
    if (emu.currentLine == null) return null;
    const loc = resolveLine(emu.currentLine, machineMain, machineExtras);
    return loc.file === activeFile ? loc.line : null;
  }, [emu.currentLine, machineMain, machineExtras, activeFile]);
  const activeBreakpoints = useMemo(
    () => breakpointsForFile(emu.breakpoints, source, extraFiles, activeFile),
    [emu.breakpoints, source, extraFiles, activeFile],
  );
  const toggleBreakpointInActive = useCallback(
    (line: number) => {
      emu.toggleBreakpoint(
        combinedLineFor(activeFile, line, sourceRef.current, extraFilesRef.current),
      );
    },
    [emu, activeFile, sourceRef, extraFilesRef],
  );
  // Breakpoints live in the hub as COMBINED-string lines, so inserting five
  // lines in main.asm re-numbers every dot in every helper below it. Nothing
  // re-anchored them: the dots slid into the wrong file on screen, and the
  // next assemble re-keyed the stale numbers through a fresh line map onto
  // instructions they never belonged to. Only the SHAPE of the workspace can
  // move a line, so the re-anchor is keyed on line counts and typing inside a
  // line costs nothing.
  const layoutShape = useMemo(() => workspaceShape(source, extraFiles), [
    source,
    extraFiles,
  ]);
  // Seeded with the workspace as it stands at mount (the strip rehydrates
  // from storage), so the first pass has nothing to move.
  const bpLayoutRef = useRef<Workspace>({ main: source, extras: extraFiles });
  // The shell's own latest-value refs are synced from ITS effects, and a
  // child's effects run before its parent's, so the hub and the workspace read
  // through them here would both be one render stale -- and a re-anchor keyed
  // on the shape gets exactly one chance at each change. This mirror is
  // written from the effect declared immediately above the reader, and effects
  // in one component run in declaration order.
  const latestRef = useRef({
    machine: emu,
    workspace: { main: source, extras: extraFiles } as Workspace,
  });
  useEffect(() => {
    latestRef.current = {
      machine: emu,
      workspace: { main: source, extras: extraFiles },
    };
  });
  useEffect(() => {
    const from = bpLayoutRef.current;
    const { machine, workspace: to } = latestRef.current;
    bpLayoutRef.current = to;
    const moved = planBreakpointRemap(machine.breakpoints, from, to);
    if (!moved) return;
    machine.remapBreakpoints((line) => moved.get(line) ?? null);
  }, [layoutShape]);
  // Controls shows the first error as plain text; name the owning file
  // when it is not the buffer labelled main.asm.
  const controlsError = useMemo(
    () =>
      errorWithFileName(
        emu.error,
        emu.assemblyErrors[0]?.line,
        machineMain,
        machineExtras,
      ),
    [emu.error, emu.assemblyErrors, machineMain, machineExtras],
  );
  // `gcc -o name` registers compiled source here; `./name` runs it. A ref,
  // so the registry survives every per-snapshot context rebuild.
  const terminalExecutablesRef = useRef<Map<string, string>>(new Map());

  // The context hands the shell refs, never the render's hub object, and the
  // deps are all stable, so this callback's identity holds and the terminal
  // pane never re-initializes underneath an open session.
  const buildTerminalContext = useCallback(
    () =>
      createTerminalContext({
        machine: emuRef,
        combinedSource: () =>
          combineSources(sourceRef.current, extraFilesRef.current),
        applySeeds,
        stageVfsFile,
        removeVfsFile,
        driveForeground,
        executables: terminalExecutablesRef.current,
      }),
    [stageVfsFile, removeVfsFile, applySeeds, driveForeground, emuRef, sourceRef, extraFilesRef],
  );

  // ---- full chrome: the maximal configuration (the playground) ----
  const editorBlock = (
    <div className="h-full flex flex-col min-h-0">
      <MultiFileTabs
        files={extraFiles}
        activeIndex={activeFile}
        onSelect={setActiveFile}
        backupCount={filesBackup.count}
        onRestoreBackup={filesBackup.restore}
        onAdd={(name) => {
          // A second tab with the same name strands one of them: a re-import
          // refreshes only the first. A tab called main.asm is worse -- it
          // still concatenates, and `resolveLine` labels its diagnostics
          // main.asm too, so the student hunts the error in the wrong buffer.
          const reason = validateFileName(name, extraFiles);
          if (reason) {
            toast.error(reason);
            return;
          }
          const clean = name.trim();
          const next: SourceFile = { name: clean, body: `// ${clean}\n` };
          const idx = extraFiles.length;
          setExtraFiles([...extraFiles, next]);
          setActiveFile(idx);
        }}
        onRemove={(idx) => {
          const next = extraFiles.filter((_, i) => i !== idx);
          setExtraFiles(next);
          if (activeFile === idx) setActiveFile(-1);
          else if (activeFile > idx) setActiveFile(activeFile - 1);
        }}
        onRename={(idx, name) => {
          const reason = validateFileName(name, extraFiles, idx);
          if (reason) {
            toast.error(reason);
            return;
          }
          const clean = name.trim();
          setExtraFiles(
            extraFiles.map((f, i) => (i === idx ? { ...f, name: clean } : f)),
          );
        }}
      />
      <div className="flex-1 min-h-0">
        <Editor
          value={editorValue}
          onChange={onEditorChange}
          currentLine={activeCurrentLine}
          currentLineInCall={emu.externalCall != null}
          breakpoints={activeBreakpoints}
          onToggleBreakpoint={toggleBreakpointInActive}
          assemblyErrors={activeErrors}
          lintWarnings={activeLint}
          onCursorChange={isMain ? setCursor : undefined}
          focusRequest={errorFocus}
          onFormat={() => {
            if (!isMain) return;
            const next = formatAsm(source);
            if (next !== source) setSource(next);
            toast.show("source formatted");
          }}
        />
      </div>
    </div>
  );

  const disasmBlock = (
    <div className="h-full overflow-auto">
      {emu.instructions.length === 0 ? (
        // Cold load / nothing assembled: the designed first-run hero, not a
        // blank dense IDE. Replaces InstructionView's bare "no program
        // assembled" line with a brief what-this-is / what-to-press lead.
        <FirstRunState onAssemble={assembleWithHistory} />
      ) : (
        <ErrorBoundary label="disassembly">
          <InstructionView
            instructions={emu.instructions}
            pc={emu.pc}
            running={emu.isRunning}
            // Inside a libc call the pc is a trampoline word, which the
            // listing does not hold; mark and follow the `bl` instead.
            anchorPc={emu.externalCall?.callSitePc ?? null}
          />
        </ErrorBoundary>
      )}
    </div>
  );

  const regsBlock = (
    <ErrorBoundary label="registers">
      <div className="h-full flex flex-col">
        {/* The prominent, always-on decode strip heads the registers column --
            the beginner's lifeline: the plain-language gloss plus the live
            bit-field view of the word under the program counter. */}
        <DecodeStrip
          source={decodeSource}
          currentLine={emu.currentLine}
          encodingHex={
            emu.instructions.find((instr) => instr.address === emu.pc)?.hex ?? null
          }
          externalCall={
            // A live terminal session steps through libc calls constantly and
            // its input lands in the terminal pane, so the card's console
            // wording would be wrong there; the strip reads as it always has.
            emu.externalCall && !foregroundLive
              ? { name: emu.externalCall.name, waiting: emu.blocked }
              : null
          }
          sessionStarted={emu.programLoaded}
        />
        <ReplayScrubber
          frames={emu.replayFrames}
          currentStep={emu.stepCount}
          onSeek={emu.seekReplay}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <RegisterPanel
            registers={emu.registers}
            changedRegs={emu.changedRegs}
            fpRegisters={emu.fpRegisters}
            changedFpRegs={emu.changedFpRegs}
            sp={emu.sp}
            pc={emu.pc}
            nzcv={emu.nzcv}
          />
        </div>
      </div>
    </ErrorBoundary>
  );

  // Every panel block wraps in its own ErrorBoundary: the blocks mount in
  // three different layouts, so wrapping at the definition covers them all,
  // and a tab switch remounts a failed one fresh. The editor stays unwrapped
  // on purpose; with the buffer surface itself broken, the route-level fault
  // page is the honest state.
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
        blocked={emu.blocked}
        ownedByTerminal={foregroundLive || launchMode === "terminal"}
        terminalOwnedFrom={terminalOwnedFrom}
        exitCode={emu.exitCode}
        vfsFiles={emu.vfsFiles}
        pushStdin={emu.pushStdin}
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
        onRestoreBookmark={emu.restoreBookmark}
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

  const rightTabs = (
    <RightTabs
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      consoleBlocked={emu.blocked}
      panes={panes}
    />
  );

  // The bug-report snapshot, built on click rather than per render: it reads
  // the top of the stack out of the machine, which the toolbar must not have
  // to hold.
  const buildDiagnostic = (): DiagnosticBundle => ({
    source,
    args: argsText || undefined,
    stdin: undefined,
    stdout: emu.stdout || undefined,
    stderr: emu.stderr || undefined,
    exitCode: emu.exitCode,
    registers: emu.registers,
    sp: emu.sp,
    pc: formatWord64(emu.pc),
    stackBytes: (() => {
      const spNum = Number(BigInt(emu.sp));
      if (!Number.isFinite(spNum)) return undefined;
      const top = emu.getMemory(spNum, 64);
      if (!top.length) return undefined;
      return Array.from(top).map(formatByte).join(" ");
    })(),
    error: emu.error,
  });

  return (
    <>
      <PlaygroundHeaderBand
        onLoadProgram={loadProgram}
        source={source}
        files={extraFiles}
        importTarget={importTarget}
        onImport={handleImport}
        onImportMany={handleImportMany}
        recent={recent}
        args={argsText}
        onArgsChange={setArgsText}
        runMode={
          offersRunMode
            ? {
                mode: launchMode,
                onChange: handleLaunchModeChange,
                disabled: foregroundLive,
              }
            : null
        }
        onShare={() => onOpenShareDialog?.()}
        onTour={() => setTutorialOpen(true)}
        onToggleTheme={() => onToggleTheme?.()}
        buildDiagnostic={buildDiagnostic}
        onOpenCommandPalette={() => onOpenCommandPalette?.()}
        onOpenShortcuts={() => onOpenShortcutsHelp?.()}
      />

      {shareBanner && (
        <div
          role="status"
          className="px-4 py-1 text-[11px] text-[var(--cyan)] border-b border-[var(--border)] bg-[var(--bg-sunken)] flex items-center justify-between"
        >
          <span>loaded a shared program from the URL</span>
          <button
            type="button"
            onClick={() => setShareBanner(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] px-1"
          >
            dismiss
          </button>
        </div>
      )}

      <FullLayout
        breakpoint={bp}
        editor={editorBlock}
        disassembly={disasmBlock}
        registers={regsBlock}
        rightTabs={rightTabs}
        panes={panes}
        consoleBlocked={emu.blocked}
        paneRequest={paneRequest ?? undefined}
      />

      <Controls
        onAssemble={assembleWithHistory}
        onStep={emu.step}
        onStepBack={emu.stepBack}
        canStepBack={emu.canStepBack}
        onRun={handleRun}
        onPause={emu.pause}
        onReset={resetMachine}
        isRunning={emu.isRunning}
        isAssembling={emu.isAssembling}
        isHalted={emu.isHalted}
        programLoaded={emu.programLoaded}
        // Terminal mode's run press on a cold load assembles and starts the
        // session, so the button must be reachable by mouse -- otherwise
        // the one-action launch exists only for the keyboard.
        runAssemblesFirst={launchable}
        blocked={emu.blocked}
        error={controlsError}
        stepCount={emu.stepCount}
      />

      <TutorialRunner
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onLoadSnippet={(src, label, args, stdin) => {
          // A snippet is a program delivery. Its stdin must ride as a
          // seed, not an immediate push: the assemble the tutorial asks
          // for next resets the machine, which would wipe a pushed queue
          // and re-apply the previous program's inputs instead.
          loadProgram({ source: src, label, args, stdin });
          setTutorialOpen(false);
        }}
        getRegister={(name) => {
          const lower = name.toLowerCase();
          if (lower === "sp") return emu.sp;
          if (lower === "pc") return String(emu.pc);
          const m = lower.match(/^[xw](\d+)$/);
          if (!m) return null;
          const idx = Number(m[1]);
          if (idx < 0 || idx > 30) return null;
          return emu.registers[idx] ?? null;
        }}
      />
    </>
  );
}
