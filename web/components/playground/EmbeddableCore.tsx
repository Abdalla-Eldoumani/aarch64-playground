"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { FullChromeBridge } from "@/components/playground/FullChromeSurface";
import { useEmulator } from "@/lib/emulator/use-emulator";
import { loadAutoSavedBuffer, useAutoSave, useRecentPrograms } from "@/lib/playground/auto-save";
import type { HandoffPayload } from "@/lib/playground/playground-handoff";
import { parseArgs } from "@/lib/playground/args";
import { formatAsm } from "@/lib/asm/asm-formatter";
import { useAutoplay, useScrollHold } from "@/lib/playground/use-autoplay";
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
import { FullChromeSurface } from "@/components/playground/lazy-full-chrome";
import { MAIN_FILE, resolveLine } from "@/lib/playground/file-map";
import { useEmbeddableState } from "@/components/playground/use-embeddable-state";
import { useToast } from "@/components/ui/Toast";
import type {
  EmbeddablePlaygroundHandle,
  EmbeddablePlaygroundProps,
} from "@/components/playground/EmbeddablePlayground";

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
// Inner core: mounted only once engaged, so the hub and its worker never start
// early. useEmulator cannot be called conditionally, so the gate lives outside.
// ---------------------------------------------------------------------------

export type FirstPress = "run" | "step" | "check";

type EmbeddableCoreProps = EmbeddablePlaygroundProps & {
  registerHandle: (handle: EmbeddablePlaygroundHandle | null) => void;
  /** The outer wrapper, which the autoplay walk watches to hold off screen. */
  frameRef: RefObject<HTMLDivElement | null>;
  /** The control pressed before the hub existed, done once it loads. */
  firstPress?: FirstPress | null;
};

export function EmbeddableCore({
  chrome,
  startSource,
  startFiles,
  startArgs,
  startStdin,
  startCursor,
  fromShare,
  readOnly,
  staticEditor,
  registerView,
  registerHeadingLevel,
  autoplay,
  autoplaySteps = 8,
  onAutoplayChange,
  showRun = true,
  showReset = true,
  showStep = true,
  showBack = true,
  showCheck = true,
  showArgs = false,
  onStateChange,
  onSourceChange,
  onCheck,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onOpenShareDialog,
  onToggleTheme,
  registerHandle,
  frameRef,
  firstPress = null,
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
  // The workspace as the machine last saw it. Lines the machine reports
  // (current line, errors, faults) resolve against this, not the live buffers,
  // or an unrelated edit moved the marker or an error into another file.
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

  // Jump to the first error in the file that owns it. The nonce re-fires the
  // jump when the student re-assembles unchanged code.
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

  // A dot set before assembling can sit where nothing runs (below the last
  // instruction). The assemble drops it, and the student is told which one
  // and why rather than watching it vanish.
  useEffect(() => {
    const dropped = emu.droppedBreakpoints;
    if (dropped.length === 0) return;
    const pinned = assembledLayoutRef.current;
    const where = dropped.map((line) => {
      const loc = resolveLine(
        line,
        pinned?.main ?? sourceRef.current,
        pinned?.extras ?? extraFilesRef.current,
      );
      return `${loc.name} line ${loc.line}`;
    });
    toast.info(
      dropped.length === 1
        ? `removed the breakpoint on ${where[0]}: no instruction runs at or after that line`
        : `removed the breakpoints on ${where.join(", ")}: no instruction runs at or after those lines`,
    );
  }, [emu.droppedBreakpoints, toast]);

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
      // A new program starts on a clean machine, breakpoints included: reset
      // keeps them for the same program, but a shorter new one could inherit
      // dots no click can reach.
      emuRef.current.clearAllBreakpoints();
      emuRef.current.reset();
      // The payload's stdin and files become this program's seeds; the working
      // set decides which reach the machine (the full playground drops stdin so
      // a reading program waits for the student at the console).
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

  // Joins the helper files onto main so `bl func` resolves across files, and
  // re-applies the input seeds after a success, since assembling reset the
  // machine. Returns whether it worked so assemble-and-run can stop there.
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
    const ok = await emu.assemble(combined, parseArgs(argsText), {
      main: source,
      extras: extraFiles,
    });
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


  // Embed and checker have no assemble button, so run assembles first when
  // nothing is loaded, the source or args changed (`runKey`), or the program
  // finished; only a paused or blocked unchanged program resumes. A failed
  // assemble skips the run. `fromTop` is Ctrl+Enter's assemble-and-run.
  const lastRunSourceRef = useRef<string | null>(null);
  const runKey = `${argsText}\n${source}`;
  // A press while that assemble is in flight is dropped: a second assemble
  // resets the machine after the first queued its seeds, so both seeds land
  // and a reading program gets its input twice.
  const embedAssemblingRef = useRef(false);
  const assembleEmbed = useCallback(async () => {
    embedAssemblingRef.current = true;
    try {
      lastRunSourceRef.current = runKey;
      const ok = await emu.assemble(source, parseArgs(argsText));
      if (ok) applySeeds();
      return ok;
    } finally {
      embedAssemblingRef.current = false;
    }
  }, [emu, source, argsText, runKey, applySeeds]);
  const runEmbed = useCallback(async (fromTop = false) => {
    if (embedAssemblingRef.current) return;
    const stale =
      fromTop ||
      emu.instructions.length === 0 ||
      lastRunSourceRef.current !== runKey ||
      emu.isHalted;
    if (stale && !(await assembleEmbed())) return;
    emu.run();
  }, [emu, runKey, assembleEmbed]);

  // Step has the same cold-start problem Run has: a bare step would advance
  // over empty memory. Same gate, so the first press assembles, re-seeds, and
  // then advances one word. A step on a finished program restarts it from the
  // top, exactly as Run does.
  const stepEmbed = useCallback(async () => {
    if (embedAssemblingRef.current) return;
    const stale =
      emu.instructions.length === 0 ||
      lastRunSourceRef.current !== runKey ||
      emu.isHalted;
    if (stale && !(await assembleEmbed())) return;
    emu.step();
  }, [emu, runKey, assembleEmbed]);

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

  // F9 outside the editor and the palette's breakpoint row act on this line.
  // Only main.asm's caret reaches the shell; on another file's tab the
  // editor's own F9 does it.
  const caretLine = activeFile === MAIN_FILE ? cursor.line : null;
  const toggleBreakpointAtCaret = useCallback(() => {
    if (caretLine == null) toast.show("put the caret on a line in the editor, then press F9");
    else emu.toggleBreakpoint(caretLine);
  }, [caretLine, emu, toast]);

  // The command Action[] is built from the state that lives here (source,
  // launch mode, hub) and surfaced through the handle so a host-rendered
  // palette reuses it. The table itself is a pure function of these deps.
  const buildCommands = useCallback(
    (): Action[] =>
      buildPaletteCommands({
        blocked: emu.blocked,
        programLoaded: emu.programLoaded,
        isRunning: emu.isRunning,
        canStepBack: emu.canStepBack,
        launchable: fullRef.current?.launchable() ?? false,
        source,
        caretLine,
        toggleBreakpoint: toggleBreakpointAtCaret,
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
        openTutorials: () => fullRef.current?.openTutorials(),
        openWalkthrough: () => fullRef.current?.openWalkthrough(),
        openConverter: () => fullRef.current?.openConverter(),
        toggleTheme: () => onToggleTheme?.(),
      }),
    [emu, assembleWithHistory, runProgram, resetMachine, source, caretLine, toggleBreakpointAtCaret, toast, onOpenShareDialog, onOpenShortcutsHelp, onToggleTheme],
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
  const onSourceChangeRef = useRef(onSourceChange);
  const assembleRef = useRef(assembleWithHistory);
  const runEmbedRef = useRef(runEmbed);
  const loadProgramRef = useRef(loadProgram);
  const buildCommandsRef = useRef(buildCommands);
  const toggleBreakpointRef = useRef(toggleBreakpointAtCaret);
  useEffect(() => {
    emuRef.current = emu;
    sourceRef.current = source;
    extraFilesRef.current = extraFiles;
    argsRef.current = argsText;
    cursorRef.current = cursor;
    onStateChangeRef.current = onStateChange;
    onSourceChangeRef.current = onSourceChange;
    assembleRef.current = assembleWithHistory;
    runEmbedRef.current = runEmbed;
    loadProgramRef.current = loadProgram;
    buildCommandsRef.current = buildCommands;
    toggleBreakpointRef.current = toggleBreakpointAtCaret;
  }, [emu, source, extraFiles, argsText, cursor, onStateChange, onSourceChange, assembleWithHistory, runEmbed, loadProgram, buildCommands, toggleBreakpointAtCaret]);

  // The buffer itself, which onStateChange deliberately does not mirror (its
  // ten fields are the machine's outcome, not the editor's). Fires on mount
  // too, so a host that persists the buffer sees the value it started from
  // and can tell an untouched program from an edited one.
  useEffect(() => {
    onSourceChangeRef.current?.(source);
  }, [source]);

  // A static view that is not read-only is a caller mistake: there is no input
  // path to honour, so the program would silently be uneditable.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && staticEditor && !readOnly) {
      console.warn(
        "EmbeddablePlayground: staticEditor renders a read-only view; pass readOnly too.",
      );
    }
  }, [staticEditor, readOnly]);

  // Autoplay: the landing hero's hands-off walk. The hub reaches it as emuRef,
  // never as a render value; the reason is in the hook.
  const walk = useAutoplay({
    enabled: Boolean(autoplay),
    steps: autoplaySteps,
    machineLoaded: emu.isLoaded,
    machine: emuRef,
    source,
    args: argsText,
    applySeeds,
    frame: frameRef,
    onChange: onAutoplayChange,
  });
  // The walk's own box scrolls wait for a reader who is scrolling the page.
  const holdScroll = useScrollHold(Boolean(autoplay));

  const currentState = useEmbeddableState({ emu, emuRef, onStateChangeRef });

  // Check grades a run of the current source, never what a stale run left
  // behind, which could pass code the student already changed. It uses the
  // authored args, not the box's: the expected output was written for them.
  // The emulator bounds the run; the 10 s poll reads emuRef, since the hub is
  // a new object every render, and is only a safety net.
  const checkKey = `${startArgs ?? ""}\n${source}`;
  const checkEmbed = useCallback(async () => {
    // A run that stopped short of its end (parked on a read, paused, faulted)
    // is not a result to grade, so it runs again from the top like a stale one.
    if (
      emu.instructions.length === 0 ||
      lastRunSourceRef.current !== checkKey ||
      !emuRef.current.isHalted
    ) {
      lastRunSourceRef.current = checkKey;
      const ok = await emu.assemble(source, parseArgs(startArgs ?? ""));
      // A failed assemble must not reach the grader (mirroring runEmbed):
      // grading the stale machine marked structural checks green against
      // source that never built. The editor markers and the error banner
      // already say why nothing was graded.
      if (!ok) return;
      // Same post-assemble seeding as Run: the exercise's stdin and
      // fixtures must be on the freshly reset machine before it runs.
      applySeeds();
      // Then end of input, as `./program < input` gives on the servers: a
      // read past the authored input sees end of file instead of waiting
      // for a key nobody will press. Run keeps the input open for typing.
      emu.closeStdin();
      emu.run();
      const startedAt = Date.now();
      do {
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
      } while (emuRef.current.isRunning && Date.now() - startedAt < 10_000);
    }
    onCheck?.(currentState());
  }, [emu, source, startArgs, checkKey, onCheck, currentState, applySeeds]);

  // Stable handle identity; every method reads through a latest-value ref so
  // the object never needs rebuilding (no re-registration churn).
  const handle = useMemo<EmbeddablePlaygroundHandle>(
    () => ({
      assemble: () => assembleRef.current(),
      // The full surface owns the run press (terminal mode hands the pane
      // over), so it owns this too; embed and checker run the machine.
      assembleAndRun: () => {
        const full = fullRef.current;
        if (full) {
          full.assembleAndRun();
          return;
        }
        // The embed's own run, from the top: main.asm alone, as its run press
        // assembles it. The workspace assemble would link the playground's
        // stored helper files into a lesson's program and file it in recents.
        void runEmbedRef.current(true);
      },
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
      toggleBreakpoint: () => toggleBreakpointRef.current(),
      walk,
    }),
    // `toast` is referentially stable (useToast memoizes it); notifyError
    // reads it, so it belongs in the dependency list.
    [loadSource, runProgram, resetMachine, toast, handleStepBack, walk],
  );

  // A press on run, step or check before the frame engaged is that action:
  // the swap to these live panes took the pressed button away before its
  // click landed, so a phone needed a second tap. Done once, when the hub
  // can run it.
  const firstPressDone = useRef(false);
  useEffect(() => {
    if (!firstPress || firstPressDone.current || !emu.isLoaded) return;
    firstPressDone.current = true;
    if (firstPress === "run") void runEmbed();
    else if (firstPress === "step") void stepEmbed();
    else void checkEmbed();
  }, [firstPress, emu.isLoaded, runEmbed, stepEmbed, checkEmbed]);

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
    // A host that names the file its program writes gets the d and v views
    // too; every other embed keeps the x registers alone.
    const floatFiles =
      registerView === undefined
        ? {}
        : {
            openOn: registerView,
            fpRegisters: emu.fpRegisters,
            changedFpRegs: emu.changedFpRegs,
            vectorRegisters: emu.vectorRegisters,
            source,
            currentLine: emu.currentLine,
          };
    return (
      <EmbedLayout
        showRun={showRun}
        showReset={showReset}
        showStep={showStep}
        showBack={showBack}
        showCheck={chrome === "checker" && showCheck}
        args={showArgs ? { value: argsText, onChange: setArgsText } : undefined}
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
        runStatus={{
          programLoaded: emu.programLoaded,
          isRunning: emu.isRunning,
          isHalted: emu.isHalted,
          blocked: emu.blocked,
          exitCode: emu.exitCode,
          stepCount: emu.stepCount,
          failed: emu.error != null,
          registers: emu.registers,
          sp: emu.sp,
          changedRegs: emu.changedRegs,
        }}
        hasOutput={emu.stdout.length + emu.stderr.length > 0}
        editor={
          staticEditor ? (
            <StaticCodeView
              value={source}
              currentLine={emu.currentLine}
              holdScroll={holdScroll}
            />
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
              followCurrentLine={!emu.isRunning && emu.stepCount > 0}
              onRunShortcut={readOnly ? undefined : handle.assembleAndRun}
              readOnly={readOnly}
              wrapLines
            />
          )
        }
        registers={
          <RegisterPanel
            {...floatFiles}
            registers={emu.registers}
            changedRegs={emu.changedRegs}
            sp={emu.sp}
            pc={emu.pc}
            nzcv={emu.nzcv}
            running={emu.isRunning}
            headingLevel={registerHeadingLevel}
            holdScroll={holdScroll}
          />
        }
        console={
          <ConsolePanel
            stdout={emu.stdout}
            stderr={emu.stderr}
            notes={emu.notes}
            blocked={emu.blocked}
            exitCode={emu.exitCode}
            vfsFiles={emu.vfsFiles}
            pushStdin={emu.pushStdin}
            onInputSent={emu.resumeAfterInput}
            echoStdin={chrome !== "checker"}
            keyHints={false}
            stepButton={showStep}
            holdScroll={holdScroll}
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
        registerBridge={registerFullChrome}
      />
    );
  }
}
