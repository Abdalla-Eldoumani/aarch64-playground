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
import dynamic from "next/dynamic";
import type { FullChromeBridge } from "@/components/playground/FullChromeSurface";
import { useEmulator } from "@/lib/emulator/use-emulator";
import { IDLE_CPU_VIEW } from "@/lib/emulator/use-cpu-view";
import { loadAutoSavedBuffer, useAutoSave, useRecentPrograms } from "@/lib/playground/auto-save";
import type { HandoffPayload } from "@/lib/playground/playground-handoff";
import { parseArgs } from "@/lib/playground/args";
import { formatAsm } from "@/lib/asm/asm-formatter";
import { useAutoplay } from "@/lib/playground/use-autoplay";
import { useWorkingSet } from "@/lib/playground/use-working-set";
import type { Action } from "@/lib/playground/commands";
import { buildPaletteCommands } from "@/lib/playground/palette-commands";
import { Editor } from "@/components/playground/lazy-editor";
import { StaticCodeView } from "@/components/playground/StaticCodeView";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import { EmbedLayout } from "@/components/playground/EmbedLayout";
import {
  combineSources,
  type SourceFile,
} from "@/components/playground/MultiFileTabs";
import { useSourceFiles } from "@/lib/hooks/use-source-files";
// The playground's own half of this shell, and everything only it renders:
// dynamic, so the landing hero (which mounts the same component in embed
// chrome) never ships the full debugger.
const FullChromeSurface = dynamic(
  () =>
    import("@/components/playground/FullChromeSurface").then(
      (m) => m.FullChromeSurface,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)]">
        loading emulator...
      </div>
    ),
  },
);
import { resolveLine } from "@/lib/playground/file-map";
import { useToast } from "@/components/ui/Toast";

/**
 * The single shared emulator surface. The full playground, the landing hero,
 * the /learn lessons, and the /practice exercises all compose this one
 * component: it OWNS the single `useEmulator()` hub and renders every panel
 * internally, so the hub's ~30 fields never cross a component boundary. The
 * chrome prop selects the configuration; the full playground is the maximal
 * one.
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
  /** Surface a host-page failure (bad share link, failed example fetch) through
   *  this component's toast instance. The page entry's own react-hot-toast
   *  binding is a separate module instance in the production chunk graph, so
   *  toasts dispatched there never reach the mounted Toaster; this component's
   *  binding reaches it. */
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
  /** Hero = read-only; lessons and exercises editable. */
  readOnly?: boolean;
  /**
   * Embed/checker chrome only: render the program through StaticCodeView
   * instead of the Monaco editor, so the code text is in the server HTML and
   * the editor never enters the host page's graph. The landing hero takes it.
   * Read-only by construction (the view has no input path), so passing it
   * without `readOnly` is a caller mistake and warns in development.
   */
  staticEditor?: boolean;
  /** Landing hero only: once the hub engages, assemble the start program and
   *  step it on a timer with no user action. Off by default, so full and
   *  checker chrome are unchanged. Suppressed under prefers-reduced-motion. */
  autoplay?: boolean;
  /** How many steps the autoplay walk takes (clamped to a small ceiling). */
  autoplaySteps?: number;
  showRun?: boolean;
  showReset?: boolean;
  /** Embed/checker step and back. On by default; the hero's autoplay frame
   *  opts out so the demo stays a two-button surface. */
  showStep?: boolean;
  showBack?: boolean;
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

// Frozen empties for the pre-engage panes, at module scope so the pre-engage
// render hands the panels the same objects every time and never remounts them
// on a parent re-render.
const NO_CHANGED_REGS: Set<number> = new Set();
const NO_VFS_FILES: string[] = [];

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
  staticEditor,
  autoplay,
  autoplaySteps = 8,
  showRun = true,
  showReset = true,
  showStep = true,
  showBack = true,
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
  // The full surface's own actions, published from inside it once its chunk
  // lands. Null on embed and checker, which never load that module, and null
  // for the first frames of full chrome, which is why the handle waits for it.
  const fullRef = useRef<FullChromeBridge | null>(null);
  const [fullReady, setFullReady] = useState(false);
  const registerFullChrome = useCallback((bridge: FullChromeBridge | null) => {
    fullRef.current = bridge;
    setFullReady(bridge !== null);
  }, []);
  const [source, setSource] = useState(startSource ?? "");
  // Advisory pre-assembly lint: frame-balance and m4-hygiene warnings,
  // refreshed shortly after the student stops typing. Warnings, never errors:
  // assembling stays available regardless.
  const [lintWarnings, setLintWarnings] = useState<
    Array<{ line: number; message: string }>
  >([]);
  const [argsText, setArgsText] = useState(startArgs ?? "");
  const [cursor, setCursor] = useState<{ line: number; column: number }>(
    startCursor ?? { line: 1, column: 1 },
  );
  const [extraFiles, setExtraFiles, filesBackup] = useSourceFiles();
  const [activeFile, setActiveFile] = useState<number>(-1);
  // The workspace as the machine last saw it. Every combined-string line the
  // MACHINE produces (the current-line marker, assembly errors, a runtime
  // fault's line) is numbered against this, not against whatever the student
  // has typed since. Resolving those against the live buffers made the marker
  // change FILES on an unrelated edit, and let an error land in the wrong tab
  // while its own assemble was still in flight.
  const [assembledLayout, setAssembledLayout] = useState<{
    main: string;
    extras: SourceFile[];
  } | null>(null);
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

  // Replacing the program text drops the launch mode: it belongs to the
  // program that set it, and a stale mode would send an unrelated
  // program's run to the terminal pane.
  const loadSource = useCallback((next: string, _label?: string) => {
    setSource(next);
    fullRef.current?.onSourceReplaced();
  }, []);


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


  const loadProgram = useCallback(
    (payload: HandoffPayload) => {
      // The replaced buffer stays recoverable through recents; entries are
      // keyed by content hash there, so repeats do not stack up.
      const prev = sourceRef.current;
      if (chrome === "full" && prev.trim().length > 0 && prev !== payload.source) {
        recent.push(nameForRecents(prev), prev);
      }
      // A fresh program starts on a fresh machine: registers, memory, console,
      // exit code, stdin queue, and VFS all clear. Breakpoints too: reset keeps
      // them for the SAME program, but a different program must not inherit
      // another's gutter dots and CPU addresses (when the new program is
      // shorter, those addresses were unreachable by any click and only a
      // reload recovered).
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
      // The launch mode, the console watermark and the shared-program banner
      // all live on the full surface; it settles them and hands back the value
      // the args box should take, which for a two-faced example its mode owns.
      setArgsText(fullRef.current?.onProgramLoaded(payload) ?? payload.args ?? "");
      setCursor(payload.cursor ?? { line: 1, column: 1 });
      lastRunSourceRef.current = null;
    },
    [chrome, recent, seedFromPayload, setExtraFiles],
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
    fullRef.current?.onAssemble();
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
  ]);


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

  // Step has the same cold-start problem Run has: a bare step would advance
  // over empty memory. Same gate, so the first press assembles, re-seeds, and
  // then advances one word. A step on a finished program restarts it from the
  // top, exactly as Run does.
  const stepEmbed = useCallback(async () => {
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
    emu.step();
  }, [emu, source, argsText, applySeeds]);

  // Back cannot pass a blocked read (the machine just re-blocks), so while
  // stdin is awaited it no-ops. One guard, two callers: the imperative handle
  // and the embed's back button.
  const handleStepBack = useCallback(() => {
    if (!emuRef.current.blocked) emuRef.current.stepBack();
  }, []);



  // Run and reset go through the full surface when it is mounted: in terminal
  // mode a run press hands the pane over instead of running, and a reset has
  // to stand a live foreground session down first. Embed and checker have
  // neither, so they take the machine straight.
  const runProgram = useCallback(() => {
    const full = fullRef.current;
    if (full) full.run();
    else emuRef.current.run();
  }, []);
  const resetMachine = useCallback(() => {
    const full = fullRef.current;
    if (full) full.resetMachine();
    else emuRef.current.reset();
  }, []);

  // The command Action[] is built from the state that lives here (source,
  // launch mode, hub) and surfaced through the handle so a host-rendered
  // palette reuses it. The table itself is a pure function of these deps.
  const buildCommands = useCallback(
    (): Action[] =>
      buildPaletteCommands({
        blocked: emu.blocked,
        programLoaded: emu.programLoaded,
        canStepBack: emu.canStepBack,
        launchable: fullRef.current?.launchable() ?? false,
        source,
        assemble: () => void assembleWithHistory(),
        step: () => emu.step(),
        stepBack: () => emu.stepBack(),
        run: () => runProgram(),
        pause: () => emu.pause(),
        reset: () => resetMachine(),
        launchInteractive: () => fullRef.current?.launchInteractive(),
        formatSource: () => {
          const next = formatAsm(source);
          if (next !== source) setSource(next);
          toast.show("source formatted");
        },
        openShare: () => onOpenShareDialog?.(),
        openShortcuts: () => onOpenShortcutsHelp?.(),
        openTour: () => fullRef.current?.openTour(),
        openConverter: () => fullRef.current?.openConverter(),
        toggleTheme: () => onToggleTheme?.(),
      }),
    [emu, assembleWithHistory, runProgram, resetMachine, source, toast, onOpenShareDialog, onOpenShortcutsHelp, onToggleTheme],
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

  // A static view that is not read-only is a caller mistake: there is no input
  // path to honour, so the program would silently be uneditable.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && staticEditor && !readOnly) {
      console.warn(
        "EmbeddablePlayground: staticEditor renders a read-only view; pass readOnly too.",
      );
    }
  }, [staticEditor, readOnly]);

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

  // Autoplay: the landing hero's hands-off walk. The hub reaches it as emuRef,
  // never as a render value; the reason is in the hook.
  useAutoplay({
    enabled: Boolean(autoplay),
    steps: autoplaySteps,
    machineLoaded: emu.isLoaded,
    machine: emuRef,
    source,
    args: argsText,
    applySeeds,
  });

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
  // source, not whatever the last Run left behind. Otherwise a stale snapshot
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
        if (!emuRef.current.blocked) runProgram();
      },
      pause: () => emuRef.current.pause(),
      step: () => {
        if (!emuRef.current.blocked) emuRef.current.step();
      },
      stepBack: handleStepBack,
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
    [loadSource, runProgram, resetMachine, toast, handleStepBack],
  );

  // Register the handle only once the hub is loaded, so a queued host action
  // (flushed by the outer component on registration) lands on a live backend.
  // Full chrome waits for the surface's bridge too: a queued loadProgram that
  // arrived first would adopt no launch mode and drop no watermark.
  useEffect(() => {
    if (!emu.isLoaded) return;
    if (chrome === "full" && !fullReady) return;
    registerHandle(handle);
    return () => registerHandle(null);
  }, [chrome, emu.isLoaded, fullReady, handle, registerHandle]);



  // 400ms: long enough that a typing burst lints once, short enough that a
  // paused student sees warnings.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      void emuRef.current
        .lint(combineSources(source, extraFiles))
        .then(setLintWarnings)
        .catch(() => setLintWarnings([]));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [source, extraFiles]);


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

  // Full chrome keeps the loading beat: it is the page's primary content and
  // there is nothing else to show. Embed and checker paint their whole frame
  // immediately and let the registers and console fill in behind it, so the
  // layout is identical before and after the hub arrives and the host page's
  // largest element is not withheld for three init round trips.
  if (!emu.isLoaded && chrome === "full") {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)]">
        loading emulator...
      </div>
    );
  }

  // embed / checker: the shared core plus a minimal control set. The panels
  // are built here, from the hub, and handed over as nodes; full-only panels
  // (and their code) never load on these surfaces at all.
  if (chrome !== "full") {
    return (
      <EmbedLayout
        showRun={showRun}
        showReset={showReset}
        showStep={showStep}
        showBack={showBack}
        showCheck={chrome === "checker" && showCheck}
        isRunning={emu.isRunning}
        // Deliberately no programLoaded test: that is what keeps the
        // cold-start assemble-first press reachable by pointer.
        canStep={!emu.isRunning && !emu.blocked}
        canStepBack={
          emu.programLoaded && emu.canStepBack && !emu.isRunning && !emu.blocked
        }
        error={emu.error}
        onRun={() => void runEmbed()}
        onReset={emu.reset}
        onStep={() => void stepEmbed()}
        onStepBack={handleStepBack}
        onCheck={() => void checkEmbed()}
        editor={
          staticEditor ? (
            <StaticCodeView value={source} currentLine={emu.currentLine} />
          ) : (
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
          )
        }
        registers={
          <RegisterPanel
            registers={emu.registers}
            changedRegs={emu.changedRegs}
            sp={emu.sp}
            pc={emu.pc}
            nzcv={emu.nzcv}
          />
        }
        console={
          <ConsolePanel
            stdout={emu.stdout}
            stderr={emu.stderr}
            blocked={emu.blocked}
            exitCode={emu.exitCode}
            vfsFiles={emu.vfsFiles}
            pushStdin={emu.pushStdin}
            echoStdin={chrome !== "checker"}
            closeStdin={emu.closeStdin}
            uploadVfsFile={stageVfsFile}
            clearConsole={emu.clearConsole}
          />
        }
      />
    );
  }

  if (chrome === "full") {
    return (
      <FullChromeSurface
        emu={emu}
        emuRef={emuRef}
        source={source}
        setSource={setSource}
        sourceRef={sourceRef}
        extraFiles={extraFiles}
        setExtraFiles={setExtraFiles}
        extraFilesRef={extraFilesRef}
        filesBackup={filesBackup}
        activeFile={activeFile}
        setActiveFile={setActiveFile}
        argsText={argsText}
        setArgsText={setArgsText}
        setCursor={setCursor}
        lintWarnings={lintWarnings}
        errorFocus={errorFocus}
        assembledLayout={assembledLayout}
        assemble={assembleWithHistory}
        loadProgram={loadProgram}
        recent={recent}
        applySeeds={applySeeds}
        stageVfsFile={stageVfsFile}
        removeVfsFile={removeVfsFile}
        fromShare={fromShare}
        onOpenCommandPalette={onOpenCommandPalette}
        onOpenShortcutsHelp={onOpenShortcutsHelp}
        onOpenShareDialog={onOpenShareDialog}
        onToggleTheme={onToggleTheme}
        registerBridge={registerFullChrome}
      />
    );
  }
}

// ---------------------------------------------------------------------------
// Outer component: owns the lazy-engage gate and the imperative handle, and
// hosts the data-embed wrapper. The hub does not exist until `engaged`.
// ---------------------------------------------------------------------------

export const EmbeddablePlayground = forwardRef<
  EmbeddablePlaygroundHandle,
  EmbeddablePlaygroundProps
>(function EmbeddablePlayground(props, ref) {
  const {
    chrome,
    startSource,
    startArgs,
    className,
    staticEditor,
    showRun = true,
    showReset = true,
    showStep = true,
    showBack = true,
    showCheck = true,
  } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Full chrome is the primary in-viewport content, so it engages on mount,
  // preserving the loading -> ready flow. Embed/checker defer to the lazy
  // trigger effect below so a multi-embed page does not spin up N workers.
  const [engaged, setEngaged] = useState(() => chrome === "full");
  // A click, a tap, a key, or focus is a user asking for the machine now, and
  // so is a press on any pre-engage control.
  const engage = useCallback(() => setEngaged(true), []);

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

    // Coming into view is not a user asking. On the landing the observer fires
    // the moment the tree hydrates, and mounting the core plus its module
    // worker in that same commit lands inside the hydration long task; one
    // idle slot moves it clear, and the timeout bounds the wait so a busy
    // thread cannot leave the hero dead.
    let idleHandle: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const engageWhenIdle = () => {
      // The observer reports every intersection change, not just the first.
      if (idleHandle !== null || idleTimer !== null) return;
      if (typeof requestIdleCallback === "function") {
        idleHandle = requestIdleCallback(engage, { timeout: 1200 });
      } else {
        idleTimer = setTimeout(engage, 0);
      }
    };
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) engageWhenIdle();
      });
      observer.observe(node);
    }
    node.addEventListener("mousedown", engage, { once: true });
    node.addEventListener("touchstart", engage, { once: true });
    node.addEventListener("keydown", engage, { once: true });
    node.addEventListener("focusin", engage, { once: true });
    return () => {
      observer?.disconnect();
      // A callback that survives the unmount would setEngaged on a gone tree.
      if (idleHandle !== null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleHandle);
      }
      if (idleTimer !== null) clearTimeout(idleTimer);
      node.removeEventListener("mousedown", engage);
      node.removeEventListener("touchstart", engage);
      node.removeEventListener("keydown", engage);
      node.removeEventListener("focusin", engage);
    };
  }, [engaged, engage]);

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
        // Only embed and checker reach this branch (full chrome engages on
        // mount), and it paints the SAME grid the engaged render paints: the
        // program in the editor area, both panes in their initial state, the
        // control band below. Withholding them moved the host page's layout
        // the moment the hub arrived. A static-editor embed draws its real
        // program here, so the code text is in the server HTML and is the
        // host page's largest element rather than a placeholder a client-side
        // chain has to replace; every other configuration keeps the loading
        // beat inside the editor area. The controls engage rather than
        // no-op, the way the wrapper's own listeners do.
        <EmbedLayout
          showRun={showRun}
          showReset={showReset}
          showStep={showStep}
          showBack={showBack}
          showCheck={chrome === "checker" && showCheck}
          isRunning={false}
          canStep
          canStepBack={false}
          error={null}
          onRun={engage}
          onReset={engage}
          onStep={engage}
          onStepBack={engage}
          onCheck={engage}
          editor={
            staticEditor && startSource !== undefined ? (
              <StaticCodeView value={startSource} currentLine={null} />
            ) : (
              <div className="flex flex-1 min-h-0 items-center justify-center text-[var(--text-secondary)] text-sm">
                loading editor...
              </div>
            )
          }
          registers={
            <RegisterPanel
              registers={IDLE_CPU_VIEW.registers}
              changedRegs={NO_CHANGED_REGS}
              sp={IDLE_CPU_VIEW.sp}
              pc={IDLE_CPU_VIEW.pc}
              nzcv={IDLE_CPU_VIEW.nzcv}
            />
          }
          console={
            <ConsolePanel
              stdout=""
              stderr=""
              blocked={false}
              exitCode={null}
              vfsFiles={NO_VFS_FILES}
              pushStdin={engage}
              echoStdin={chrome !== "checker"}
              closeStdin={engage}
              uploadVfsFile={engage}
              clearConsole={engage}
            />
          }
        />
      )}
    </div>
  );
});
