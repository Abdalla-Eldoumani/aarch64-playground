"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmulatorState } from "@/lib/emulator/use-emulator";
import { useBreakpoint, usePhoneShape, useScreenHeight } from "@/lib/hooks/use-breakpoint";
import type { useRecentPrograms } from "@/lib/playground/auto-save";
import type { HandoffPayload } from "@/lib/playground/playground-handoff";
import { parseFrameSlots } from "@/lib/emulator/frame-labels";
import { collectDiagnostic } from "@/lib/playground/diagnostic-bundle";
import { formatAsm } from "@/lib/asm/asm-formatter";
import { useLaunchMode } from "@/lib/playground/use-launch-mode";
import type { WorkingSet } from "@/lib/playground/use-working-set";
import { useTerminalDrive } from "@/lib/playground/use-terminal-drive";
import { createTerminalContext } from "@/lib/playground/terminal-context";
import { getImportTarget } from "@/lib/hooks/use-import-target";
import { Editor } from "@/components/playground/lazy-editor";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { Controls } from "@/components/playground/Controls";
import { DecodeStrip } from "@/components/panels/DecodeStrip";
import { FirstRunState } from "@/components/playground/FirstRunState";
import { FullLayout } from "@/components/playground/FullLayout";
import { PlaygroundHeaderBand } from "@/components/playground/PlaygroundHeaderBand";
import { Toolbar } from "@/components/playground/Toolbar";
import { RightTabs, type RightTab } from "@/components/playground/RightTabs";
import {
  MultiFileTabs,
  type SourceFile,
} from "@/components/playground/MultiFileTabs";
import type { SourceFilesBackup } from "@/lib/hooks/use-source-files";
import {
  InstructionView,
  InterfaceWalkthrough,
  ReplayScrubber,
  TutorialRunner,
} from "@/components/playground/lazy-panels";
import { validateFileName } from "@/lib/playground/file-map";
import { useToast } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { fileStub, useWorkspaceImport } from "@/components/playground/use-workspace-import";
import { useFullChromeRun } from "@/components/playground/use-full-chrome-run";

import { useActiveFile } from "@/components/playground/use-active-file";
import { useDebugPanes } from "@/components/playground/use-debug-panes";
/**
 * The full-chrome actions the shell defers to. This surface loads lazily, so
 * it publishes them upward on mount and the shell reads them through a ref,
 * falling back to the plain machine in embed and checker.
 */
export type FullChromeBridge = {
  /** A program handoff landed: adopt its launch and return the value the args
   *  box should take, drop the previous session's watermark, and set the
   *  shared-program banner. */
  onProgramLoaded: (payload: HandoffPayload) => string;
  /** An assemble of the workspace on screen is about to reset the machine
   *  and empty the console. */
  onAssemble: () => void;
  /** The buffer was replaced without a payload, so the launch mode it
   *  belonged to goes with it. */
  onSourceReplaced: () => void;
  /** Reset through the drive, so a live foreground session stands down, and
   *  restart the program when the workspace still matches what was
   *  assembled. */
  resetMachine: () => void;
  /** Run, which in terminal mode hands the pane over instead. */
  run: () => void;
  /** Ctrl+Enter: assemble, then run the way a run press would. */
  assembleAndRun: () => void;
  /** Whether the composite launch has somewhere to land. */
  launchable: () => boolean;
  launchInteractive: () => void;
  openConverter: () => void;
  openTutorials: () => void;
  openWalkthrough: () => void;
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
 * The playground's own half of the shared shell. Its own module, loaded
 * through dynamic(), so the landing hero, which mounts the shell, never ships
 * the layouts, the terminal drive, or the launch tables. The hub crosses into
 * here because the launch-mode and terminal-drive hooks live nowhere else.
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
  const phone = usePhoneShape();
  const height = useScreenHeight();
  // A phone has its own compact chrome; the short layout is for the rest.
  const short = height === "short" && phone === null;
  const [activeTab, setActiveTab] = useState<RightTab>("memory");
  // The view the phone layout has on screen; the desktop tab state above
  // says nothing about a phone.
  const [phonePane, setPhonePane] = useState("code");
  const shownPane = phone ? phonePane : activeTab;
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
  // Each bump opens the walkthrough where the student left it.
  const [walkthroughRequest, setWalkthroughRequest] = useState(0);
  const openWalkthrough = useCallback(() => setWalkthroughRequest((n) => n + 1), []);
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
  const importTarget = getImportTarget(activeFile);
  const { loadedSourceRef, loadedFilesRef, handleImport, handleImportMany, loadProgramWithConfirm } =
    useWorkspaceImport({ source, setSource, extraFiles, setExtraFiles, toast, resetLaunch, loadProgram });
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
    terminalTabActive: shownPane === "term",
    requestPane,
  });
  const {
    launchInteractive,
    assembleAndRun,
    loadedRef,
    noteAssembled,
    handleRun,
    handleRunRef,
    restartProgram,
    launchable,
  } = useFullChromeRun({
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
  });

  // Published upward once, as a stable object reading the live values through
  // a ref: the shell built the callbacks that call these before this module
  // had loaded.
  const liveRef = useRef({
    adoptLaunch,
    dropTerminalWatermark,
    noteAssembled,
    resetLaunch,
    restartProgram,
    assembleAndRun,
    launchable,
    launchInteractive,
  });
  useEffect(() => {
    liveRef.current = {
      adoptLaunch,
      dropTerminalWatermark,
      noteAssembled,
      resetLaunch,
      restartProgram,
      assembleAndRun,
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
        loadedSourceRef.current = payload.source;
        loadedFilesRef.current = new Map((payload.files ?? []).map((f) => [f.name, f.body]));
        return nextArgs;
      },
      onAssemble: () => {
        liveRef.current.dropTerminalWatermark();
        liveRef.current.noteAssembled();
      },
      onSourceReplaced: () => liveRef.current.resetLaunch(),
      resetMachine: () => liveRef.current.restartProgram(),
      run: () => handleRunRef.current(),
      assembleAndRun: () => void liveRef.current.assembleAndRun(),
      launchable: () => liveRef.current.launchable,
      launchInteractive: () => void liveRef.current.launchInteractive(),
      openConverter: () => requestPane("convert"),
      openTutorials: () => setTutorialOpen(true),
      openWalkthrough,
    };
    registerBridge(bridge);
    return () => registerBridge(null);
  }, [registerBridge, requestPane, openWalkthrough, loadedSourceRef, loadedFilesRef, handleRunRef]);

  const {
    isMain,
    editorValue,
    onEditorChange,
    decodeSource,
    activeErrors,
    activeLint,
    activeCurrentLine,
    executing,
    activeBreakpoints,
    toggleBreakpointInActive,
    controlsError,
  } = useActiveFile({
    emu,
    source,
    setSource,
    sourceRef,
    extraFiles,
    setExtraFiles,
    extraFilesRef,
    activeFile,
    setActiveFile,
    lintWarnings,
    assembledLayout,
  });

  const frameSlots = useMemo(() => parseFrameSlots(source), [source]);
  const fpValue = useMemo(() => {
    const raw = emu.registers[29];
    if (!raw) return 0;
    const clean = raw.startsWith("0x") ? raw.slice(2) : raw;
    return parseInt(clean, 16) || 0;
  }, [emu.registers]);

  // Hidden file picker the terminal's `upload` command triggers.
  const terminalUploadRef = useRef<HTMLInputElement>(null);
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
        workspace: () => ({ main: sourceRef.current, extras: extraFilesRef.current }),
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
          // refreshes only the first. A tab called main.asm is worse: it still
          // concatenates, and `resolveLine` labels its diagnostics main.asm
          // too, so the student hunts the error in the wrong buffer.
          const reason = validateFileName(name, extraFiles);
          if (reason) {
            toast.error(reason);
            return;
          }
          const clean = name.trim();
          const next: SourceFile = { name: clean, body: fileStub(clean) };
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
      <div className="flex-1 min-h-0" data-walkthrough="editor">
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
          followCurrentLine={executing}
          onRunShortcut={() => void assembleAndRun()}
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

  // The listing is its own scroll box, so it can follow the pc.
  const disasmBlock =
    emu.instructions.length === 0 ? (
      // Cold load / nothing assembled: FirstRunState replaces
      // InstructionView's bare "no program assembled" line with a
      // what-this-is / what-to-press lead.
      <div className="h-full overflow-auto">
        <FirstRunState onAssemble={assembleWithHistory} />
      </div>
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
    );

  const regsBlock = (
    <ErrorBoundary label="registers">
      <div className="h-full flex flex-col" data-walkthrough="registers">
        {/* The always-on decode strip heads the registers column: the
            plain-language gloss plus the live bit-field view of the word under
            the program counter. */}
        <DecodeStrip
          source={decodeSource}
          currentLine={emu.currentLine}
          encodingHex={
            emu.instructions.find((instr) => instr.address === emu.pc)?.hex ?? null
          }
          externalCall={
            // A live terminal session steps through libc calls constantly and
            // its input lands in the terminal pane, so the card's console
            // wording would be wrong there; the strip reads as it does for any
            // other run.
            emu.externalCall && !foregroundLive
              ? { name: emu.externalCall.name, waiting: emu.blocked }
              : null
          }
          sessionStarted={emu.programLoaded}
          // A short window drops the field meanings (the line under the
          // fields names the registers instead), so the list below keeps
          // about nine rows mid-run.
          compact={short}
        />
        <ReplayScrubber
          frames={emu.replayFrames}
          currentStep={emu.stepCount}
          onSeek={emu.seekReplay}
        />
        {/* A phone on its side left the list no height under the decode
            strip; the floor makes the phone's view scroll to it instead. */}
        <div className={`flex-1 overflow-auto ${phone ? "min-h-[13rem]" : "min-h-0"}`}>
          <RegisterPanel
            registers={emu.registers}
            changedRegs={emu.changedRegs}
            fpRegisters={emu.fpRegisters}
            changedFpRegs={emu.changedFpRegs}
            vectorRegisters={emu.vectorRegisters}
            source={decodeSource}
            currentLine={emu.currentLine}
            sp={emu.sp}
            pc={emu.pc}
            nzcv={emu.nzcv}
            running={emu.isRunning}
          />
        </div>
      </div>
    </ErrorBoundary>
  );

  // Every panel block wraps in its own ErrorBoundary: the blocks mount in three
  // different layouts, so wrapping at the definition covers them all, and a tab
  // switch remounts a failed one fresh. The editor stays unwrapped on purpose;
  // with the buffer surface itself broken, the route-level fault page is the
  // right fallback.
  const panes = useDebugPanes({
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
  });

  // Output that lands while another tab is up (a run's printf behind the
  // memory view) marks the console tab until the student opens it. The
  // length seen is adjusted during render, not in an effect, so the mark
  // never paints a frame after the console is already showing; a cleared
  // console resets it.
  const outputLength = emu.stdout.length + emu.stderr.length;
  const [seenOutput, setSeenOutput] = useState(0);
  if (seenOutput !== outputLength && (shownPane === "console" || outputLength < seenOutput)) {
    setSeenOutput(outputLength);
  }
  const consoleUnread = shownPane !== "console" && outputLength > seenOutput;

  // A run that stops because the program finished brings the console
  // forward on a phone, where the code view gave no sign the run was over. A
  // stop at a breakpoint, a pause, or a read leaves the view alone, and so
  // does a finish reached by stepping. The halt lands a beat before the run
  // flag drops, so both are read at the drop.
  const [wasRunning, setWasRunning] = useState(emu.isRunning);
  if (wasRunning !== emu.isRunning) {
    setWasRunning(emu.isRunning);
    if (phone && wasRunning && emu.isHalted && outputLength > 0) {
      setPaneRequest((prev) => ({ pane: "console", nonce: (prev?.nonce ?? 0) + 1 }));
    }
  }

  const rightTabs = (
    <RightTabs
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      consoleBlocked={emu.blocked}
      consoleUnread={consoleUnread}
      panes={panes}
    />
  );

  // The bug-report snapshot, gathered when its dialog opens rather than per
  // render: it reads memory and the virtual files out of the machine, which
  // the toolbar must not have to hold. Lines the machine reports count in the
  // assembled layout; the program it carries is the one on screen.
  const buildDiagnostic = () =>
    collectDiagnostic({
      machine: emuRef.current,
      workspace: { main: source, extras: extraFiles },
      assembled: assembledLayout,
      args: argsText,
      userAgent: navigator.userAgent,
    });

  // The tools' actions, shared by the header band and, in a short window,
  // the run row that carries the tools instead.
  const openShare = () => onOpenShareDialog?.();
  const openTutorials = () => setTutorialOpen(true);
  const toggleTheme = () => onToggleTheme?.();
  const openCommandPalette = () => onOpenCommandPalette?.();
  const openShortcuts = () => onOpenShortcutsHelp?.();

  const controls = (
    <Controls
      onAssemble={assembleWithHistory}
      onStep={emu.step}
      onStepBack={emu.stepBack}
      canStepBack={emu.canStepBack}
      onRun={handleRun}
      onPause={emu.pause}
      onReset={restartProgram}
      isRunning={emu.isRunning}
      isAssembling={emu.isAssembling}
      isHalted={emu.isHalted}
      programLoaded={emu.programLoaded}
      blocked={emu.blocked}
      error={controlsError}
      stepCount={emu.stepCount}
      compact={phone !== null}
      short={short}
      trailing={
        short ? (
          <Toolbar
            className="sm:ml-auto"
            onShare={openShare}
            onTutorials={openTutorials}
            onToggleTheme={toggleTheme}
            buildDiagnostic={buildDiagnostic}
            onOpenCommandPalette={openCommandPalette}
            onOpenShortcuts={openShortcuts}
          />
        ) : undefined
      }
    />
  );

  return (
    <>
      {/* Ahead of the header band, so the first-visit offer is the first
          stop a Tab from the top reaches. */}
      <InterfaceWalkthrough openRequest={walkthroughRequest} />
      <PlaygroundHeaderBand
        compact={phone !== null}
        short={short}
        onLoadProgram={loadProgramWithConfirm}
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
        onShare={openShare}
        onTutorials={openTutorials}
        onToggleTheme={toggleTheme}
        buildDiagnostic={buildDiagnostic}
        onOpenCommandPalette={openCommandPalette}
        onOpenShortcuts={openShortcuts}
        onWalkthrough={openWalkthrough}
      />

      {shareBanner && (
        <div
          role="status"
          className="px-4 py-1 text-[12px] text-[var(--cyan)] border-b border-[var(--border)] bg-[var(--bg-sunken)] flex items-center justify-between"
        >
          <span>loaded a shared program from the URL</span>
          <button
            type="button"
            onClick={() => setShareBanner(false)}
            className="touch-target text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[12px] px-1"
          >
            dismiss
          </button>
        </div>
      )}

      <FullLayout
        breakpoint={bp}
        phone={phone}
        height={height}
        editor={editorBlock}
        disassembly={disasmBlock}
        registers={regsBlock}
        rightTabs={rightTabs}
        panes={panes}
        consoleBlocked={emu.blocked}
        consoleUnread={consoleUnread}
        paneRequest={paneRequest ?? undefined}
        onPaneShown={setPhonePane}
        runStatus={{
          programLoaded: emu.programLoaded,
          isRunning: emu.isRunning,
          isHalted: emu.isHalted,
          blocked: emu.blocked,
          exitCode: emu.exitCode,
          stepCount: emu.stepCount,
          failed: controlsError != null,
          registers: emu.registers,
          sp: emu.sp,
          changedRegs: emu.changedRegs,
        }}
        controls={controls}
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
        onStartWalkthrough={() => {
          setTutorialOpen(false);
          openWalkthrough();
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
