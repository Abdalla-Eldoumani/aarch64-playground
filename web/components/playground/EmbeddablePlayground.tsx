"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEmulator } from "@/lib/emulator/use-emulator";
import { useBreakpoint, isAtLeast } from "@/lib/hooks/use-breakpoint";
import { loadAutoSavedBuffer, useAutoSave, useRecentPrograms } from "@/lib/playground/auto-save";
import {
  EXAMPLE_INTERACTIVE,
  decodeLaunch,
  legacyModeArgsFor,
  modeArgsFor,
  type HandoffPayload,
  type LaunchMode,
} from "@/lib/playground/playground-handoff";
import { parseFrameSlots } from "@/lib/emulator/frame-labels";
import { parseArgs } from "@/lib/playground/args";
import { formatAsm } from "@/lib/asm/asm-formatter";
import { MAX_VFS_BYTES, checkUploadSize } from "@/lib/playground/upload-guard";
import { useWorkingSet } from "@/lib/playground/use-working-set";
import { useTerminalDrive } from "@/lib/playground/use-terminal-drive";
import { createTerminalContext } from "@/lib/playground/terminal-context";
import {
  describeTarget,
  getImportTarget,
  type ImportTarget,
} from "@/lib/hooks/use-import-target";
import type { Action } from "@/lib/playground/commands";
import { buildPaletteCommands } from "@/lib/playground/palette-commands";
import { Editor } from "@/components/playground/Editor";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import { Controls } from "@/components/playground/Controls";
import { DecodeStrip } from "@/components/panels/DecodeStrip";
import { FirstRunState } from "@/components/playground/FirstRunState";
import { ExampleLoader } from "@/components/playground/ExampleLoader";
import { RunModeControl } from "@/components/playground/RunModeControl";
import { RecentPrograms } from "@/components/playground/RecentPrograms";
import { ResizableLayout } from "@/components/playground/ResizableLayout";
import { MobileLayout } from "@/components/playground/MobileLayout";
import { ImportExport } from "@/components/playground/ImportExport";
import { Toolbar } from "@/components/playground/Toolbar";
import { ArgsInput } from "@/components/playground/ArgsInput";
import {
  MultiFileTabs,
  combineSources,
  type SourceFile,
} from "@/components/playground/MultiFileTabs";
import { useSourceFiles } from "@/lib/hooks/use-source-files";
// Full-only / heavy panels load on first render so a multi-embed page (and
// the embed/checker chrome) never ships their code.
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

// Persisted beside the files strip so a reloaded workspace remembers which
// surface owns the pane at run press. The key name predates the mode having
// two spellings: it still holds the "1" / "0" a returning student's browser
// wrote, which decodeLaunch reads unchanged.
const LAUNCH_MODE_KEY = "aarch64-playground:terminal-program";

/**
 * The single shared emulator surface. The full playground, the landing
 * hero, the /learn lessons, and the /practice exercises all compose this
 * one component (EMBEDDABLE_COMPONENT.md): it OWNS the single
 * `useEmulator()` hub and renders every panel internally, so the hub's
 * ~30 fields never cross a component boundary. The chrome prop selects
 * the configuration; the full playground is the maximal one.
 */
export type EmbeddableChrome = "full" | "embed" | "checker";

/**
 * The outcome slice the host reads for in-place output and the future
 * outcome checker. Exactly these ten fields mirror the hub; this is the
 * single definition consumers import (no redeclaration elsewhere).
 */
export type EmbeddableState = {
  registers: string[];
  sp: string;
  pc: number;
  nzcv: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  isRunning: boolean;
  isHalted: boolean;
  error: string | null;
};

/**
 * Imperative handle the host drives the component through. The page-level
 * keyboard shortcuts, command palette, and share dialog all act through
 * this rather than reaching into the hub.
 */
export type EmbeddablePlaygroundHandle = {
  assemble(): void;
  run(): void;
  pause(): void;
  step(): void;
  stepBack(): void;
  reset(): void;
  /** Load a program into the editable buffer (recent / bookmark / tutorial). */
  loadSource(source: string, label?: string): void;
  /** Deliver a complete program handoff (example, share link, bundle):
   *  preserves the replaced buffer in recents, resets the machine, then
   *  applies source, args, cursor, and the stdin/vfs input seeds. */
  loadProgram(payload: HandoffPayload): void;
  getSource(): string;
  getFiles(): SourceFile[];
  getArgs(): string;
  getCursor(): { line: number; column: number };
  /** The command Action[] built inside the component so a host-rendered
   *  palette has no duplicate logic. */
  getCommands(): Action[];
  /** Surface a host-page failure (bad share link, failed example fetch)
   *  through this component's toast instance. The page entry's own
   *  react-hot-toast binding is a separate module instance in the
   *  production chunk graph, so toasts dispatched there never reach the
   *  mounted Toaster; this component's binding provably does. */
  notifyError(message: string): void;
};

export type EmbeddablePlaygroundProps = {
  chrome: EmbeddableChrome;
  startSource?: string;
  /** Extra files a share-link boot carried. Defined (even empty) means
   *  "replace the persisted files strip"; undefined leaves it alone. */
  startFiles?: SourceFile[];
  startArgs?: string;
  startStdin?: string;
  startCursor?: { line: number; column: number };
  /** The host knows a program arrived from a share link; drives the banner. */
  fromShare?: boolean;
  /** Hero = non-editable taste; lessons / exercises editable. */
  readOnly?: boolean;
  /** Landing hero only: once the hub engages, assemble the start program and
   *  step it on a timer with no user action. Off by default, so full and
   *  checker chrome are unchanged. Suppressed under prefers-reduced-motion. */
  autoplay?: boolean;
  /** How many steps the autoplay walk takes (clamped to a small ceiling). */
  autoplaySteps?: number;
  showRun?: boolean;
  showReset?: boolean;
  /** Check only applies in checker chrome. */
  showCheck?: boolean;
  onStateChange?: (state: EmbeddableState) => void;
  /** Checker Check button; the evaluation itself lands in a later milestone. */
  onCheck?: (state: EmbeddableState) => void;
  // Page-chrome hooks: the host renders these modals and owns the theme;
  // the component's full-chrome header triggers them so there is no
  // duplicated palette / share / theme logic.
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  onOpenShareDialog?: () => void;
  onToggleTheme?: () => void;
  className?: string;
};

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/** The right-hand tab strip's panes, in the order the strip renders them. */
type RightTab =
  | "memory"
  | "stack"
  | "console"
  | "term"
  | "watches"
  | "convert"
  | "memwatch"
  | "saves";

// One naming rule for every recents entry: the program's first comment
// line, or a timestamped snippet label when it has none.
function nameForRecents(source: string): string {
  const firstComment = source
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("//") || l.startsWith(";"));
  return firstComment
    ? firstComment.replace(/^(?:\/\/|;)\s*/, "").slice(0, 48)
    : `snippet ${new Date().toLocaleTimeString()}`;
}

// Autoplay cadence for the landing hero: a short step interval so the register
// flash and the pc marker read clearly, and a hard ceiling so the walk stays
// bounded regardless of the host-supplied step count.
const AUTOPLAY_STEP_MS = 450;
const AUTOPLAY_MAX_STEPS = 10;

// ---------------------------------------------------------------------------
// Inner core: mounted only after the lazy trigger fires, so the hub (and the
// worker / WASM it instantiates) never spins up before the component is
// actually engaged. useEmulator cannot be called conditionally, which is why
// the engage gate lives in the outer component and the hub lives here.
// ---------------------------------------------------------------------------

type EmbeddableCoreProps = EmbeddablePlaygroundProps & {
  registerHandle: (handle: EmbeddablePlaygroundHandle | null) => void;
};

function EmbeddableCore({
  chrome,
  startSource,
  startFiles,
  startArgs,
  startStdin,
  startCursor,
  fromShare,
  readOnly,
  autoplay,
  autoplaySteps = 8,
  showRun = true,
  showReset = true,
  showCheck = true,
  onStateChange,
  onCheck,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onOpenShareDialog,
  onToggleTheme,
  registerHandle,
}: EmbeddableCoreProps) {
  const emu = useEmulator();
  // The hub as a latest-value ref (synced in the effect further down, with
  // the other such refs). Declared here because callbacks and hooks all the
  // way through the body read the machine through it: the hub is a NEW object
  // after every snapshot, so a closure over the render's object freezes
  // mid-command state.
  const emuRef = useRef(emu);
  const bp = useBreakpoint();
  const [source, setSource] = useState(startSource ?? "");
  // Advisory pre-assembly lint: frame-balance and m4-hygiene warnings,
  // refreshed shortly after the student stops typing. Warnings, never
  // errors -- assembling stays available regardless.
  const [lintWarnings, setLintWarnings] = useState<
    Array<{ line: number; message: string }>
  >([]);
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
  const [argsText, setArgsText] = useState(startArgs ?? "");
  const [shareBanner, setShareBanner] = useState(Boolean(fromShare));
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [cursor, setCursor] = useState<{ line: number; column: number }>(
    startCursor ?? { line: 1, column: 1 },
  );
  const [extraFiles, setExtraFiles, filesBackup] = useSourceFiles();
  const [activeFile, setActiveFile] = useState<number>(-1);
  // The workspace as the machine last saw it. Every combined-string line the
  // MACHINE produces -- the current-line marker, assembly errors, a runtime
  // fault's line -- is numbered against this, not against whatever the
  // student has typed since. Resolving those against the live buffers made
  // the marker change FILES on an unrelated edit, and let an error land in
  // the wrong tab while its own assemble was still in flight.
  const [assembledLayout, setAssembledLayout] = useState<{
    main: string;
    extras: SourceFile[];
  } | null>(null);
  // Who owns the pane when this program's run is pressed: a live terminal
  // session (the visualizer example, or the student's own choice) or the
  // classic console flow. Persisted beside the files strip so a reloaded
  // workspace keeps the takeover.
  const [launchMode, setLaunchModeState] = useState<LaunchMode>(() => {
    if (typeof window === "undefined") return "console";
    try {
      return decodeLaunch(window.localStorage.getItem(LAUNCH_MODE_KEY));
    } catch {
      return "console";
    }
  });
  // Read by the blocked-jump effect, which must not re-subscribe.
  const launchModeRef = useRef<LaunchMode>("console");
  const setLaunchMode = useCallback((next: LaunchMode) => {
    launchModeRef.current = next;
    setLaunchModeState(next);
    try {
      window.localStorage.setItem(LAUNCH_MODE_KEY, next);
    } catch {
      // storage full or blocked; the mode just won't survive a reload
    }
  }, []);
  // The example this workspace came from, when it came from one. The
  // run-mode control is offered for exactly the stems that have a real
  // answer to the question; a hand-written buffer has none, so it stays
  // null and the header band is the one every other program sees.
  const [loadedStem, setLoadedStem] = useState<string | null>(null);
  // The args the loaded payload carried. With the mode's two seeded forms
  // it is the third value that still counts as a clean args box, so a
  // fixture-seeded program keeps following the mode until the student types
  // something of their own.
  const payloadArgsRef = useRef("");
  // The run-mode control moves the args box too, for the examples that wear
  // a different face per surface. It stops at the student: a box edited to
  // anything the app did not put there is theirs, in either mode.
  const handleLaunchModeChange = useCallback(
    (next: LaunchMode) => {
      setLaunchMode(next);
      const seeded = modeArgsFor(loadedStem, next);
      if (seeded == null) return;
      const clean =
        argsText === "" ||
        argsText === modeArgsFor(loadedStem, "console") ||
        argsText === payloadArgsRef.current;
      if (clean) setArgsText(seeded);
    },
    [argsText, loadedStem, setLaunchMode],
  );
  // The console face used to seed `./<stem> console`; the emulator now
  // owns argv[0], so that stored box would hand the program an extra
  // argument and land it on its usage path. Migrate that exact string --
  // whichever ingress restored it -- and leave every other box alone.
  useEffect(() => {
    if (argsText !== "" && argsText === legacyModeArgsFor(loadedStem)) {
      setArgsText(modeArgsFor(loadedStem, "console") ?? "");
    }
  }, [argsText, loadedStem]);
  // A text-only swap or an import replaces the program without a payload:
  // the mode and the stem both belonged to the program that set them, and
  // a stale mode would send an unrelated program's run to the pane.
  const resetLaunch = useCallback(() => {
    setLaunchMode("console");
    setLoadedStem(null);
  }, [setLaunchMode]);
  useEffect(() => {
    launchModeRef.current = launchMode;
  }, [launchMode]);
  // The terminal mounts lazily on first use and then stays mounted (see
  // the tab panel below): a live session must survive tab switches.
  const [termOpened, setTermOpened] = useState(false);
  useEffect(() => {
    if (activeTab === "term") setTermOpened(true);
  }, [activeTab]);

  // A share-link boot carries its own workspace: replace the persisted
  // files strip once, before the first assemble can mix the two.
  const startFilesApplied = useRef(false);
  useEffect(() => {
    if (startFiles === undefined || startFilesApplied.current) return;
    startFilesApplied.current = true;
    setExtraFiles(startFiles);
  }, [startFiles, setExtraFiles]);

  // Jump-to-error: when an assemble or a line-carrying runtime fault
  // lands, the editor switches to the owning file, then reveals and
  // focuses the offending line. Nonce so the same line re-fires when the
  // student re-assembles unchanged. Combined-string lines resolve through
  // the file map so an error inside an extra file lands in that tab, not
  // past the end of main.asm.
  const [errorFocus, setErrorFocus] = useState<{ line: number; nonce: number } | null>(null);
  // Read through a ref, not the layout state, so the jump keeps its single
  // dependency on the errors themselves.
  const assembledLayoutRef = useRef<{ main: string; extras: SourceFile[] } | null>(null);
  const pinAssembledLayout = useCallback((main: string, extras: SourceFile[]) => {
    const layout = { main, extras };
    assembledLayoutRef.current = layout;
    setAssembledLayout(layout);
  }, []);
  useEffect(() => {
    const first = emu.assemblyErrors[0];
    if (first && first.line > 0) {
      const pinned = assembledLayoutRef.current;
      const loc = resolveLine(
        first.line,
        pinned?.main ?? sourceRef.current,
        pinned?.extras ?? extraFilesRef.current,
      );
      setActiveFile(loc.file);
      setErrorFocus({ line: loc.line, nonce: Date.now() });
    }
  }, [emu.assemblyErrors]);
  const toast = useToast();
  const importTarget = getImportTarget(activeFile);

  // Replacing the program text drops the launch mode: it belongs to the
  // program that set it, and a stale mode would send an unrelated
  // program's run to the terminal pane.
  const loadSource = useCallback(
    (next: string, _label?: string) => {
      setSource(next);
      resetLaunch();
    },
    [resetLaunch],
  );

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
    [extraFiles, setExtraFiles, toast, resetLaunch],
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
    [extraFiles, setExtraFiles, toast, resetLaunch],
  );

  // Only the full playground persists to the shared auto-save buffer; embed
  // and checker surfaces carry host-supplied programs that must not overwrite
  // the user's saved playground work.
  useAutoSave(source, chrome === "full");
  const recent = useRecentPrograms();

  // A boot buffer that arrived through a handoff (a share link or bundle
  // opened in a fresh tab) displaced the autosave before the first
  // debounced write could run; keep that prior work reachable through
  // recents instead of silently overwriting it. On a normal boot the
  // autosave IS the start buffer, so nothing is pushed.
  useEffect(() => {
    if (chrome !== "full") return;
    const prior = loadAutoSavedBuffer();
    if (prior && prior.trim().length > 0 && prior !== (startSource ?? "")) {
      recent.push(nameForRecents(prior), prior);
    }
    // Mount-only: the boot buffer comparison is meaningful exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Input seeds and the working file set: what the machine needs on it that
  // is not the program text, and the record assemble's reset restores from.
  const { applySeeds, stageVfsFile, removeVfsFile, seedFromPayload } = useWorkingSet({
    isHome: chrome === "full",
    startStdin,
    machine: emuRef,
    machineLoaded: emu.isLoaded,
  });

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

  const loadProgram = useCallback(
    (payload: HandoffPayload) => {
      // The replaced buffer stays recoverable through recents; entries are
      // keyed by content hash there, so repeats do not stack up.
      const prev = sourceRef.current;
      if (chrome === "full" && prev.trim().length > 0 && prev !== payload.source) {
        recent.push(nameForRecents(prev), prev);
      }
      // A fresh program starts on a fresh machine: registers, memory,
      // console, exit code, stdin queue, and VFS all clear. Breakpoints
      // too -- reset deliberately keeps them for the SAME program, but a
      // different program must not inherit another's gutter dots and CPU
      // addresses (when the new program is shorter, those addresses were
      // unreachable by any click and only a reload recovered).
      emuRef.current.clearAllBreakpoints();
      emuRef.current.reset();
      // The payload's stdin and fixtures become this program's seeds. Which
      // of them actually reach the machine is the working set's call: the
      // full playground drops stdin seeds (a reading program should block and
      // pull the student to the console) and merges fixtures into the home
      // directory, while embed and checker keep authored seeds and replace
      // the VFS strictly.
      seedFromPayload(payload);
      setSource(payload.source);
      // A program handoff replaces the whole workspace: stale helper
      // files from earlier work must not concatenate into the new
      // program at its next assemble.
      setExtraFiles(payload.files ?? []);
      setActiveFile(-1);
      const launch = payload.launch === "terminal" ? "terminal" : "console";
      setLaunchMode(launch);
      setLoadedStem(payload.stem ?? null);
      // A mode-args example wears a different face per surface, so the mode
      // owns its args box: the console face takes the token, the terminal
      // face takes none. That overrides the fixture args the payload
      // carries (temp-convert declares both), and the payload's own value
      // is remembered as one of the forms a still-clean box may hold.
      payloadArgsRef.current = payload.args ?? "";
      setArgsText(modeArgsFor(payload.stem, launch) ?? payloadArgsRef.current);
      setCursor(payload.cursor ?? { line: 1, column: 1 });
      // A new program starts on a fresh console; no session owns it yet.
      dropTerminalWatermark();
      setShareBanner(Boolean(payload.fromShare));
      lastRunSourceRef.current = null;
    },
    [chrome, recent, seedFromPayload, setExtraFiles, setLaunchMode, dropTerminalWatermark],
  );

  // Push the current buffer onto the recent list whenever the user
  // assembles, and concatenate any extra files so `bl func` resolves across
  // files (the linker operates on one string). On success, re-apply the
  // program's input seeds: the assemble reset the machine, and the seeded
  // stdin and VFS files must be in place before the run. Returns the
  // verdict so a composite action can stop at a failed assemble; the
  // button and palette callers ignore it.
  const assembleWithHistory = useCallback(async (): Promise<boolean> => {
    // The assemble resets the machine and empties the console, so a
    // previous session's watermark points at bytes that are gone.
    dropTerminalWatermark();
    const trimmed = source.trim();
    if (trimmed.length > 0) {
      recent.push(nameForRecents(source), source);
    }
    const combined =
      extraFiles.length > 0 ? combineSources(source, extraFiles) : source;
    // Pin the workspace the machine is about to see BEFORE awaiting: every
    // combined line it reports back is numbered against exactly these
    // buffers, however much the student types while the assemble is in
    // flight.
    pinAssembledLayout(source, extraFiles);
    const ok = await emu.assemble(combined, parseArgs(argsText));
    if (ok) applySeeds();
    return ok;
  }, [
    source,
    recent,
    emu,
    extraFiles,
    argsText,
    applySeeds,
    pinAssembledLayout,
    dropTerminalWatermark,
  ]);

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

  // The reduced embed/checker chrome has no separate Assemble control, so its
  // primary Run must assemble first; otherwise runUntilBreak executes over
  // empty memory and nothing the student wrote runs. Assemble when nothing is
  // loaded yet (fresh or post-reset, instructions empty), the source changed
  // since the last run, or the machine has halted (Run on a finished program
  // means run it again from the start), awaiting the hub so the backend is
  // loaded before run. A failed assemble skips the run, and a successful one
  // re-applies the program's input seeds: the assemble reset the machine, so
  // seeded stdin and VFS files must be back in place before the run. Only a
  // blocked or paused unchanged program resumes without re-assembling.
  const lastRunSourceRef = useRef<string | null>(null);
  const runEmbed = useCallback(async () => {
    if (
      emu.instructions.length === 0 ||
      lastRunSourceRef.current !== source ||
      emu.isHalted
    ) {
      lastRunSourceRef.current = source;
      const ok = await emu.assemble(source, parseArgs(argsText));
      if (!ok) return;
      applySeeds();
    }
    emu.run();
  }, [emu, source, argsText, applySeeds]);

  // Run in terminal mode: hand the program the pane up front -- switch
  // the tab, then let the attach effect below start the drive once the
  // pane's io registration lands (the pane mounts lazily on the tab
  // switch, so the drive cannot start synchronously here).
  const handleRun = useCallback(() => {
    if (launchMode === "terminal" && chrome === "full") {
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
  }, [launchMode, chrome, emu, launchInteractive, requestPane, requestTerminalRun]);
  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  // The run-mode control is offered for the examples where both surfaces
  // are a real answer; every other program keeps today's header band.
  const showRunMode =
    chrome === "full" && loadedStem !== null && EXAMPLE_INTERACTIVE[loadedStem] === true;
  // Whether the composite launch has somewhere to land: only the terminal
  // mode owns the pane at run press, and only full chrome has a pane.
  const launchable = chrome === "full" && launchMode === "terminal";

  // The command Action[] is built from the state that lives here (source,
  // launch mode, hub) and surfaced through the handle so a host-rendered
  // palette reuses it. The table itself is a pure function of these deps.
  const buildCommands = useCallback(
    (): Action[] =>
      buildPaletteCommands({
        blocked: emu.blocked,
        programLoaded: emu.programLoaded,
        canStepBack: emu.canStepBack,
        launchable,
        source,
        assemble: () => void assembleWithHistory(),
        step: () => emu.step(),
        stepBack: () => emu.stepBack(),
        run: () => handleRun(),
        pause: () => emu.pause(),
        reset: () => resetMachine(),
        launchInteractive: () => void launchInteractive(),
        formatSource: () => {
          const next = formatAsm(source);
          if (next !== source) setSource(next);
          toast.show("source formatted");
        },
        openShare: () => onOpenShareDialog?.(),
        openShortcuts: () => onOpenShortcutsHelp?.(),
        openTour: () => setTutorialOpen(true),
        openConverter: () => {
          setActiveTab("convert");
          setPaneRequest((prev) => ({ pane: "convert", nonce: (prev?.nonce ?? 0) + 1 }));
        },
        toggleTheme: () => onToggleTheme?.(),
      }),
    [emu, assembleWithHistory, handleRun, launchable, launchInteractive, resetMachine, source, toast, onOpenShareDialog, onOpenShortcutsHelp, onToggleTheme],
  );

  // Latest-value refs so the imperative handle stays a stable object while
  // still reading live editor / hub state when the host calls a method. The
  // refs are synced in an effect; the react-hooks rules forbid writing a ref
  // during render.
  const sourceRef = useRef(source);
  const extraFilesRef = useRef(extraFiles);
  const argsRef = useRef(argsText);
  const cursorRef = useRef(cursor);
  const onStateChangeRef = useRef(onStateChange);
  const assembleRef = useRef(assembleWithHistory);
  const loadProgramRef = useRef(loadProgram);
  const buildCommandsRef = useRef(buildCommands);
  useEffect(() => {
    emuRef.current = emu;
    sourceRef.current = source;
    extraFilesRef.current = extraFiles;
    argsRef.current = argsText;
    cursorRef.current = cursor;
    onStateChangeRef.current = onStateChange;
    assembleRef.current = assembleWithHistory;
    loadProgramRef.current = loadProgram;
    buildCommandsRef.current = buildCommands;
  }, [emu, source, extraFiles, argsText, cursor, onStateChange, assembleWithHistory, loadProgram, buildCommands]);

  // Seed starter stdin once the hub is live so a program that reads has its
  // input queued before the first run.
  const seededStdin = useRef(false);
  useEffect(() => {
    if (chrome === "full") return;
    if (emu.isLoaded && startStdin && !seededStdin.current) {
      seededStdin.current = true;
      emu.pushStdin(startStdin);
    }
  }, [chrome, emu, emu.isLoaded, startStdin]);

  // Autoplay (landing hero only): once the hub is loaded, assemble the start
  // program and step it a bounded number of times on a timer so the registers
  // flash and the pc marker advances with no user action. Keyed STRICTLY on
  // [emu.isLoaded, autoplay]: useEmulator returns a NEW object after every step
  // (its memo deps include the changing registers/pc), so listing `emu` here
  // would re-run this effect after the first step, the cleanup would clear the
  // timer, and the once-per-engage guard would then block any restart -- the
  // hero would step once and freeze. The hub is read through emuRef (synced
  // every render above) so the timer survives the per-step re-renders.
  const hasAutoplayedRef = useRef(false);
  useEffect(() => {
    if (!autoplay || !emu.isLoaded || hasAutoplayedRef.current) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hasAutoplayedRef.current = true;

    const steps = Math.max(0, Math.min(autoplaySteps, AUTOPLAY_MAX_STEPS));
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const walk = async () => {
      // Assemble directly (not assembleWithHistory) so the hero never pollutes
      // the recent-programs list, and await it so the steps land on a loaded
      // program. Read the hub through emuRef so a register re-render cannot
      // strand the timer on a stale hub. Seeds re-apply after the successful
      // assemble, the same as every other assemble path.
      const ok = await emuRef.current.assemble(source, parseArgs(argsText));
      if (ok) applySeeds();
      if (cancelled || !ok || steps === 0) return;
      let stepped = 0;
      timer = setInterval(() => {
        emuRef.current.step();
        stepped += 1;
        if (stepped >= steps && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, AUTOPLAY_STEP_MS);
    };
    void walk();

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emu.isLoaded, autoplay]);

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
    [],
  );

  // The checker's Check must evaluate a snapshot that matches the CURRENT
  // source, not whatever the last Run left behind -- otherwise a stale snapshot
  // can PASS on code the student already edited away, or every result fails on
  // zeroed pre-run state before any Run. Reuse runEmbed's assemble-if-stale
  // guard (the shared lastRunSourceRef): when nothing has run yet or the source
  // changed since the last run, assemble + run it to completion first, then
  // snapshot; an unchanged, already-run program is checked as-is. The run loop
  // is bounded by the emulator's own step ceiling; the wall-clock poll is only
  // a safety net, and reads the live hub through emuRef so a per-render new hub
  // identity is always observed.
  const checkEmbed = useCallback(async () => {
    if (emu.instructions.length === 0 || lastRunSourceRef.current !== source) {
      lastRunSourceRef.current = source;
      const ok = await emu.assemble(source, parseArgs(argsText));
      // A failed assemble must not reach the grader (mirroring runEmbed):
      // grading the stale machine marked structural checks green against
      // source that never built. The editor markers and the error banner
      // already say why nothing was graded.
      if (!ok) return;
      // Same post-assemble seeding as Run: the exercise's stdin and
      // fixtures must be on the freshly reset machine before it runs.
      applySeeds();
      emu.run();
      const startedAt = Date.now();
      do {
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
      } while (emuRef.current.isRunning && Date.now() - startedAt < 10_000);
    }
    onCheck?.(currentState());
  }, [emu, source, argsText, onCheck, currentState, applySeeds]);

  // Stable handle identity; every method reads through a latest-value ref so
  // the object never needs rebuilding (no re-registration churn).
  const handle = useMemo<EmbeddablePlaygroundHandle>(
    () => ({
      assemble: () => assembleRef.current(),
      // Run, step, and back cannot pass a blocked read (the machine just
      // re-blocks), so while stdin is awaited they no-op like the disabled
      // buttons; assemble and reset stay live as the two real exits.
      run: () => {
        if (!emuRef.current.blocked) handleRunRef.current();
      },
      pause: () => emuRef.current.pause(),
      step: () => {
        if (!emuRef.current.blocked) emuRef.current.step();
      },
      stepBack: () => {
        if (!emuRef.current.blocked) emuRef.current.stepBack();
      },
      reset: () => resetMachine(),
      notifyError: (message: string) => toast.error(message),
      loadSource: (next: string) => loadSource(next),
      loadProgram: (payload: HandoffPayload) => loadProgramRef.current(payload),
      getSource: () => sourceRef.current,
      getFiles: () => extraFilesRef.current,
      getArgs: () => argsRef.current,
      getCursor: () => cursorRef.current,
      getCommands: () => buildCommandsRef.current(),
    }),
    // `toast` is referentially stable (useToast memoizes it); notifyError
    // reads it, so it belongs in the dependency list.
    [loadSource, resetMachine, toast],
  );

  // Register the handle only once the hub is loaded, so a queued host action
  // (flushed by the outer component on registration) lands on a live backend.
  useEffect(() => {
    if (!emu.isLoaded) return;
    registerHandle(handle);
    return () => registerHandle(null);
  }, [emu.isLoaded, handle, registerHandle]);

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
    [isMain, activeFile, extraFiles, setExtraFiles],
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

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void emuRef.current
        .lint(combineSources(source, extraFiles))
        .then(setLintWarnings)
        .catch(() => setLintWarnings([]));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [source, extraFiles]);

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
    [emu, activeFile],
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
  useEffect(() => {
    const from = bpLayoutRef.current;
    const to: Workspace = { main: sourceRef.current, extras: extraFilesRef.current };
    bpLayoutRef.current = to;
    const moved = planBreakpointRemap(emuRef.current.breakpoints, from, to);
    if (!moved) return;
    emuRef.current.remapBreakpoints((line) => moved.get(line) ?? null);
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
    [stageVfsFile, removeVfsFile, applySeeds, driveForeground],
  );

  if (emu.loadError) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 px-6 text-center">
        <span className="text-sm text-[var(--danger)]">failed to load emulator</span>
        <pre className="text-xs text-[var(--text-secondary)] max-w-xl whitespace-pre-wrap">
          {emu.loadError}
        </pre>
        <span className="text-xs text-[var(--text-secondary)]">
          check the browser console for details, then reload the page
        </span>
      </div>
    );
  }

  if (!emu.isLoaded) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)]">
        loading emulator...
      </div>
    );
  }

  // embed / checker: the shared core plus a minimal control set. Full-only
  // panels (and their code) never load here. The editor / registers / console
  // arrangement comes from the container-driven embed-grid areas in
  // globals.css, so each host's own width (a prose measure, a wide hero)
  // picks the layout rather than the viewport.
  if (chrome !== "full") {
    return (
      <div className="embed-layout flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 embed-grid">
          <div className="embed-area-editor min-h-0 min-w-0 flex flex-col">
            <Editor
              value={source}
              onChange={readOnly ? () => {} : setSource}
              currentLine={emu.currentLine}
              currentLineInCall={emu.externalCall != null}
              breakpoints={emu.breakpoints}
              onToggleBreakpoint={emu.toggleBreakpoint}
              assemblyErrors={emu.assemblyErrors}
              lintWarnings={lintWarnings}
              onCursorChange={setCursor}
              focusRequest={errorFocus}
              readOnly={readOnly}
            />
          </div>
          <div className="embed-area-registers min-h-0 min-w-0 overflow-auto">
            <RegisterPanel
              registers={emu.registers}
              changedRegs={emu.changedRegs}
              sp={emu.sp}
              pc={emu.pc}
              nzcv={emu.nzcv}
            />
          </div>
          <div className="embed-area-console min-h-0 min-w-0 overflow-hidden flex flex-col">
            <ConsolePanel
              stdout={emu.stdout}
              stderr={emu.stderr}
              blocked={emu.blocked}
              exitCode={emu.exitCode}
              vfsFiles={emu.vfsFiles}
              pushStdin={emu.pushStdin}
              closeStdin={emu.closeStdin}
              uploadVfsFile={stageVfsFile}
              clearConsole={emu.clearConsole}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
          {showRun && (
            // Run stays available on a halted machine: runEmbed re-assembles
            // and restarts, so a finished (or edited) program runs again
            // without a reset. Only an in-flight run disables it.
            <button
              type="button"
              onClick={() => void runEmbed()}
              disabled={emu.isRunning}
              aria-label="run"
              className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              run
            </button>
          )}
          {showReset && (
            <button
              type="button"
              onClick={emu.reset}
              aria-label="reset"
              className="min-h-[44px] px-4 rounded border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              reset
            </button>
          )}
          {chrome === "checker" && showCheck && (
            <button
              type="button"
              onClick={() => void checkEmbed()}
              aria-label="check"
              className="min-h-[44px] px-4 rounded bg-[var(--cyan)] text-[var(--bg-base)] text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
            >
              check
            </button>
          )}
          {/* A fault must be visible here too: full chrome surfaces
              emu.error through Controls, and without this line an embedded
              run that faults just stops silently. */}
          {emu.error && (
            <p
              role="alert"
              title={emu.error}
              className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--danger)]"
            >
              {emu.error}
            </p>
          )}
        </div>
      </div>
    );
  }

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
        ownedByTerminal={foregroundLive || (launchMode === "terminal" && chrome === "full")}
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

  const rightTabs = (
    <div className="h-full flex flex-col">
      <div
        className="flex flex-wrap border-b border-[var(--border)] bg-[var(--bg-sunken)] overflow-x-auto"
        role="tablist"
        aria-label="debug view"
      >
        {(["memory", "stack", "console", "term", "watches", "convert", "memwatch", "saves"] as const).map((tab) => {
          const selected = activeTab === tab;
          const showDot = tab === "console" && emu.blocked && !selected;
          return (
            <button
              key={tab}
              id={`right-tab-${tab}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`right-panel-${tab}`}
              className={`relative min-h-[2.25rem] px-4 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
                selected
                  ? "text-[var(--cyan)] border-b border-[var(--cyan)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {showDot && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--cyan)]"
                />
              )}
            </button>
          );
        })}
      </div>
      <div
        className="flex-1 min-h-0 overflow-hidden"
        role="tabpanel"
        id={`right-panel-${activeTab}`}
        aria-labelledby={`right-tab-${activeTab}`}
      >
        {activeTab === "memory" && (
          <div className="h-full overflow-auto">{memoryBlock}</div>
        )}
        {activeTab === "stack" && (
          <div className="h-full overflow-auto">{stackBlock}</div>
        )}
        {activeTab === "console" && (
          <div className="h-full flex flex-col">{consoleBlock}</div>
        )}
        {/* The terminal stays MOUNTED once opened and hides with CSS.
            Unmounting it disposed xterm and dropped the io registration,
            so switching to another tab mid-session killed a running
            program's screen and its input -- the student had to re-run
            it. `hidden` keeps the DOM node (and the session) alive. */}
        {termOpened && (
          <div className={activeTab === "term" ? "h-full" : "hidden"}>
            {terminalBlock}
          </div>
        )}
        {activeTab === "watches" && (
          <div className="h-full overflow-auto">{watchBlock}</div>
        )}
        {activeTab === "convert" && (
          <div className="h-full overflow-auto">{converterBlock}</div>
        )}
        {activeTab === "memwatch" && (
          <div className="h-full overflow-auto">{memWatchBlock}</div>
        )}
        {activeTab === "saves" && (
          <div className="h-full overflow-auto">{savesBlock}</div>
        )}
      </div>
    </div>
  );

  const showResizable = isAtLeast(bp, "lg");
  const showTablet = !showResizable && isAtLeast(bp, "md");

  return (
    <>
      {/* header-band: under sm this row stops wrapping and scrolls within
          itself, so the editor stays near the top of a phone screen instead
          of sitting under seven rows of chrome. */}
      <div className="header-band safe-area-top flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-sunken)]">
        <span className="hidden sm:inline font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
          aarch64-pg
        </span>
        <div className="min-w-0 shrink-0">
          <ExampleLoader onLoad={loadProgram} />
        </div>
        <ImportExport
          source={source}
          files={extraFiles}
          target={importTarget}
          onImport={handleImport}
          onImportMany={handleImportMany}
        />
        <RecentPrograms
          entries={recent.entries}
          // A recent is a program delivery, not a text swap: the machine
          // resets and the seeds clear, so the previous program's
          // registers, console, stdin, and VFS cannot show under the
          // recalled source. The displaced buffer lands in recents.
          onLoad={(body) => loadProgram({ source: body })}
          onClear={recent.clear}
        />
        <ArgsInput source={source} value={argsText} onChange={setArgsText} />
        {showRunMode && (
          <RunModeControl
            mode={launchMode}
            onChange={handleLaunchModeChange}
            // A live session owns the pane; flipping the mode under it
            // would move the console's ownership badge mid-run.
            disabled={foregroundLive}
          />
        )}
        <Toolbar
          className="ml-auto"
          onShare={() => onOpenShareDialog?.()}
          onTour={() => setTutorialOpen(true)}
          onToggleTheme={() => onToggleTheme?.()}
          buildDiagnostic={() => ({
            source,
            args: argsText || undefined,
            stdin: undefined,
            stdout: emu.stdout || undefined,
            stderr: emu.stderr || undefined,
            exitCode: emu.exitCode,
            registers: emu.registers,
            sp: emu.sp,
            pc: `0x${emu.pc.toString(16).padStart(16, "0")}`,
            stackBytes: (() => {
              const spNum = Number(BigInt(emu.sp));
              if (!Number.isFinite(spNum)) return undefined;
              const top = emu.getMemory(spNum, 64);
              if (!top.length) return undefined;
              return Array.from(top)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(" ");
            })(),
            error: emu.error,
          })}
          onOpenCommandPalette={() => onOpenCommandPalette?.()}
          sourceLink={
            <a
              href="https://github.com/Abdalla-Eldoumani/aarch64-playground"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center min-h-[36px] rounded-[var(--radius-control)] px-2.5 text-[12px] font-sans text-[var(--text-secondary)] hover:text-[var(--cyan)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
              aria-label="View source on GitHub"
            >
              source
            </a>
          }
        />
        <button
          type="button"
          onClick={() => onOpenShortcutsHelp?.()}
          className="shrink-0 inline-flex items-center min-h-[36px] text-xs text-[var(--text-secondary)] hover:text-[var(--cyan)] rounded px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
          aria-label="keyboard shortcuts"
        >
          ?
        </button>
      </div>

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

      {/* A labeled section, not a main: this component is composed inside the
          landing hero, lessons, exercises, and the reference, all of which
          already sit inside their page's main. The /playground route supplies
          the one main around it. */}
      <section aria-label="cpsc 355 playground" className="flex-1 min-h-0 flex flex-col">
        {showResizable ? (
          <ResizableLayout
            breakpoint={bp}
            editor={editorBlock}
            disassembly={disasmBlock}
            registers={regsBlock}
            rightTabs={rightTabs}
          />
        ) : showTablet ? (
          <div className="flex flex-row h-full">
            <div className="flex flex-col w-1/2 border-r border-[var(--border)] min-h-0">
              <div className="flex-1 min-h-0 flex flex-col">{editorBlock}</div>
              <div className="h-40 border-t border-[var(--border)] overflow-auto">
                {disasmBlock}
              </div>
            </div>
            <div className="flex flex-col w-1/2 min-h-0">
              <div className="flex-1 min-h-0 overflow-auto border-b border-[var(--border)]">
                {regsBlock}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{rightTabs}</div>
            </div>
          </div>
        ) : (
          <MobileLayout
            editor={editorBlock}
            disassembly={disasmBlock}
            registers={regsBlock}
            memory={memoryBlock}
            stack={stackBlock}
            console={consoleBlock}
            terminal={terminalBlock}
            watches={watchBlock}
            converter={converterBlock}
            memwatch={memWatchBlock}
            saves={savesBlock}
            consoleBlocked={emu.blocked}
            paneRequest={paneRequest ?? undefined}
          />
        )}
      </section>

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

// ---------------------------------------------------------------------------
// Outer component: owns the lazy-engage gate and the imperative handle, and
// hosts the data-embed wrapper. The hub does not exist until `engaged`.
// ---------------------------------------------------------------------------

export const EmbeddablePlayground = forwardRef<
  EmbeddablePlaygroundHandle,
  EmbeddablePlaygroundProps
>(function EmbeddablePlayground(props, ref) {
  const { chrome, startSource, startArgs, className } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Full chrome is the primary in-viewport content, so it engages on mount,
  // preserving the loading -> ready flow. Embed/checker defer to the lazy
  // trigger effect below so a multi-embed page does not spin up N workers.
  const [engaged, setEngaged] = useState(() => chrome === "full");

  const innerHandleRef = useRef<EmbeddablePlaygroundHandle | null>(null);
  const pendingRef = useRef<Array<(handle: EmbeddablePlaygroundHandle) => void>>([]);

  const registerHandle = useCallback(
    (handle: EmbeddablePlaygroundHandle | null) => {
      innerHandleRef.current = handle;
      if (handle && pendingRef.current.length > 0) {
        const queued = pendingRef.current;
        pendingRef.current = [];
        for (const apply of queued) apply(handle);
      }
    },
    [],
  );

  // An action that arrives before the hub is engaged engages it first and
  // replays once the inner core registers its handle.
  const runOrQueue = useCallback(
    (apply: (handle: EmbeddablePlaygroundHandle) => void) => {
      const handle = innerHandleRef.current;
      if (handle) {
        apply(handle);
        return;
      }
      pendingRef.current.push(apply);
      setEngaged(true);
    },
    [],
  );

  useEffect(() => {
    if (engaged) return;
    const node = wrapperRef.current;
    if (!node) return;

    const engage = () => setEngaged(true);
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) engage();
      });
      observer.observe(node);
    }
    node.addEventListener("mousedown", engage, { once: true });
    node.addEventListener("touchstart", engage, { once: true });
    node.addEventListener("keydown", engage, { once: true });
    node.addEventListener("focusin", engage, { once: true });
    return () => {
      observer?.disconnect();
      node.removeEventListener("mousedown", engage);
      node.removeEventListener("touchstart", engage);
      node.removeEventListener("keydown", engage);
      node.removeEventListener("focusin", engage);
    };
  }, [engaged]);

  useImperativeHandle(
    ref,
    () => ({
      assemble: () => runOrQueue((handle) => handle.assemble()),
      run: () => runOrQueue((handle) => handle.run()),
      pause: () => runOrQueue((handle) => handle.pause()),
      step: () => runOrQueue((handle) => handle.step()),
      stepBack: () => runOrQueue((handle) => handle.stepBack()),
      reset: () => runOrQueue((handle) => handle.reset()),
      loadSource: (next: string, label?: string) =>
        runOrQueue((handle) => handle.loadSource(next, label)),
      loadProgram: (payload: HandoffPayload) =>
        runOrQueue((handle) => handle.loadProgram(payload)),
      notifyError: (message: string) =>
        runOrQueue((handle) => handle.notifyError(message)),
      getSource: () => innerHandleRef.current?.getSource() ?? startSource ?? "",
      getFiles: () => innerHandleRef.current?.getFiles() ?? [],
      getArgs: () => innerHandleRef.current?.getArgs() ?? startArgs ?? "",
      getCursor: () =>
        innerHandleRef.current?.getCursor() ?? { line: 1, column: 1 },
      getCommands: () => innerHandleRef.current?.getCommands() ?? [],
    }),
    [runOrQueue, startSource, startArgs],
  );

  // data-embed marks the wrapper in embed mode as a host-facing hook so a
  // parent page or iframe can detect and style the embedded surface. The
  // reduced chrome itself is selected by the chrome prop, not this attribute.
  return (
    <div
      ref={wrapperRef}
      data-embed={chrome === "embed" ? "1" : undefined}
      className={joinClasses("flex flex-col flex-1 min-h-0", className)}
    >
      {engaged ? (
        <EmbeddableCore {...props} registerHandle={registerHandle} />
      ) : (
        <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)] text-sm">
          loading editor...
        </div>
      )}
    </div>
  );
});
