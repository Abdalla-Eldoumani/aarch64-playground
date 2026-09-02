"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickBackend, type EmulatorBackend } from "@/lib/emulator/backend";
import { buildDisassembly, type DecodedInstruction } from "@/lib/emulator/disassembly";
import { detectHostedMode } from "@/lib/emulator/emulator";
import type {
  AssembleOutcome,
  AssemblyError,
  EmulatorState,
} from "@/lib/emulator/emulator-state";
import {
  emptyLineMap,
  isEmptyLineMap,
  parseLineMap,
  pcToSourceLineFromMap,
  type LineMap,
} from "@/lib/emulator/line-map";
import type { MemoryRegion } from "@/lib/emulator/memory-map";
import { hasAssemblableContent, pcToSourceLine } from "@/lib/emulator/source-lines";
import { useBackendPassthroughs } from "@/lib/emulator/use-backend-passthroughs";
import { useBreakpoints } from "@/lib/emulator/use-breakpoints";
import { useConsoleOutput } from "@/lib/emulator/use-console-output";
import { useCpuView } from "@/lib/emulator/use-cpu-view";
import { useMemoryCache } from "@/lib/emulator/use-memory-cache";
import { parseArgs } from "@/lib/playground/args";
import type { ExternalCall, StateSnapshot } from "@/lib/worker/protocol";

// The hub is the import site every consumer already uses, so the contract
// and the helpers it owns stay reachable from here.
export type { AssembleOutcome, AssemblyError, DecodedInstruction, EmulatorState };
export { indexedInstructionText, stripSourceLines } from "@/lib/emulator/source-lines";
export {
  appendBounded,
  CONSOLE_TRIM_MARKER,
  MAX_CONSOLE_CHARS,
} from "@/lib/emulator/use-console-output";

export function useEmulator(): EmulatorState {
  const backendRef = useRef<EmulatorBackend | null>(null);
  const runningRef = useRef(false);
  const sourceRef = useRef("");
  const frameRef = useRef(0);
  // Authoritative linker address -> editor-line map for the current
  // assembly. Empty until the first successful hosted assemble; an empty
  // map signals the legacy source-text line-count fallback (bare-metal,
  // where instruction index and non-label source line are already 1:1).
  const lineMapRef = useRef<LineMap>(emptyLineMap());
  // Most-recent snapshot's `(addr, len)` writes. Drives memory-cell
  // diff highlighting in the replay scrubber and MemoryPanel. Cleared
  // whenever a snapshot reports no writes (assemble, reset, or a
  // non-storing step) so stale ranges never linger.
  const dirtyAddrsRef = useRef<Array<[number, number]>>([]);
  // Live halted flag for the run() guard. The embed and checker call a
  // `run` captured before their awaited assemble, so a state-closure
  // guard would still see the pre-assemble halt and silently skip the
  // run; the ref always reflects the latest snapshot.
  const haltedRef = useRef(false);
  // Loaded-program gate for the execution controls. Stepping or running an
  // empty machine decodes zeroed memory ("unknown instruction: 0x00000000")
  // and fills the replay ring with steps that never really executed, so
  // run/step/stepBack no-op until an assemble succeeds. A ref shadows the
  // state for the same reason as haltedRef: callbacks captured before an
  // awaited assemble must see the fresh flag.
  const programLoadedRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [isHalted, setIsHalted] = useState(false);
  const [programLoaded, setProgramLoaded] = useState(false);
  const [canStepBack, setCanStepBack] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<AssemblyError[]>([]);
  const [externalCall, setExternalCall] = useState<ExternalCall | null>(null);
  const [instructions, setInstructions] = useState<DecodedInstruction[]>([]);
  const [codeBase, setCodeBase] = useState(0x400000);
  const [memoryRegions, setMemoryRegions] = useState<MemoryRegion[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [wantsTerminal, setWantsTerminal] = useState(false);
  const wantsTerminalRef = useRef(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hostedMode, setHostedMode] = useState(false);
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [savedStates, setSavedStates] = useState<string[]>([]);
  const [dirtyAddrsTick, setDirtyAddrsTick] = useState(0);

  const { getMemory, getMemoryMapped, invalidate: invalidateMemory } =
    useMemoryCache(backendRef);
  const {
    stdout,
    stderr,
    appendStdout,
    appendStderr,
    syncSeen,
    clearScrollback,
    preserveScrollback,
    clearConsole,
    setOutputTap,
  } = useConsoleOutput(backendRef);
  const {
    pushStdin,
    closeStdin,
    setSnapshotsPaused,
    lint,
    uploadVfsFile,
    readVfsFile,
    deleteVfsFile,
    resolveLabel,
    m4Expand,
    saveState,
    deleteState,
  } = useBackendPassthroughs(backendRef);
  const {
    registers,
    sp,
    pc,
    nzcv,
    changedRegs,
    fpRegisters,
    changedFpRegs,
    currentLine,
    replayTick,
    applyRegisters,
    latestSnapRef,
    markCurrentLine,
    pushReplayFrame,
    readReplayFrames,
    resetReplayHistory,
    seekReplay,
    setCurrentLine,
  } = useCpuView();
  const {
    breakpoints,
    toggleBreakpoint,
    remapBreakpoints,
    clearAllBreakpoints,
    setBreakpointAddress,
    clearBreakpointAddress,
    rekeyAfterAssemble,
  } = useBreakpoints({ backendRef, lineMapRef, sourceRef, codeBase });

  const applySnapshot = useCallback((snap: StateSnapshot) => {
    if (snap.frame > frameRef.current) {
      frameRef.current = snap.frame;
      invalidateMemory();
    }
    const pcNum = applyRegisters(snap);
    setIsHalted(snap.halted);
    haltedRef.current = snap.halted;
    setBlocked(snap.blocked);
    // A halted machine wants nothing: the emulator only ever SETS raw mode
    // (a termios call) and never clears it on exit, // A halted machine wants
    // nothing: the emulator only ever SETS raw mode and never clears it on
    // exit, so the flag would otherwise outlive the program that set it.
    const wantsTerm = snap.wantsTerminal && !snap.halted;
    wantsTerminalRef.current = wantsTerm;
    setWantsTerminal(wantsTerm);
    setExitCode(snap.exitCode);
    setCanStepBack(snap.canStepBack);
    setVfsFiles(snap.vfsFiles);
    setSavedStates(snap.savedStates);
    if (snap.stdoutDelta) appendStdout(snap.stdoutDelta);
    if (snap.stderrDelta) appendStderr(snap.stderrDelta);
    // The machine's cumulative display counters are the scrollback's
    // absolute coordinates. A step back or a restored save rolls them
    // BACK, and the transcript unprints with them so a re-run reprints
    // without duplicating itself. A wasm build that predates the counters
    // sends neither, and the scrollback stays append-only as before.
    if (snap.stdoutSeen != null) syncSeen("stdout", snap.stdoutSeen);
    if (snap.stderrSeen != null) syncSeen("stderr", snap.stderrSeen);
    // Drive the current-line marker off the linker's authoritative
    // address->editor-line map: look the snapshot pc up directly instead
    // of counting non-label source lines (which double-counts data/macro
    // lines and drifts on complex programs). Fall back to the legacy
    // line-count path only when the map is empty (bare-metal, already 1:1).
    // An external call is a PAUSED-state affordance. A run passes through
    // one on every printf, so honoring it mid-run would strobe the card and
    // drag the marker back to the call site on every heartbeat; the pc the
    // run reports is the truth there.
    const call = (!runningRef.current && snap.externalCall) || null;
    setExternalCall(call);
    const map = lineMapRef.current;
    // No program, no marker: snapshots that arrive while the machine is
    // empty (boot heartbeats, reset, a failed assemble) must not resurrect
    // a stale line through the previous program's map.
    if (!programLoadedRef.current) {
      markCurrentLine(null);
    } else if (call) {
      // Inside a libc call the pc is a trampoline word or a synthetic stub;
      // the line the student is on is the `bl` that got there (null when the
      // map cannot name it, which reads as "no line").
      markCurrentLine(call.callSiteLine);
    } else if (!isEmptyLineMap(map)) {
      markCurrentLine(pcToSourceLineFromMap(pcNum, map));
    } else {
      const instrIndex = (pcNum - codeBase) / 4;
      if (instrIndex >= 0) {
        markCurrentLine(pcToSourceLine(instrIndex, sourceRef.current));
      }
    }
    // dirtyAddrs are surfaced through a separate ref so the memory
    // panel + replay scrubber can highlight changed cells without
    // forcing a full memory cache invalidation.
    if (snap.dirtyAddrs && snap.dirtyAddrs.length > 0) {
      // The flat array is `[addr, len, addr, len, ...]`.
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i + 1 < snap.dirtyAddrs.length; i += 2) {
        pairs.push([snap.dirtyAddrs[i], snap.dirtyAddrs[i + 1]]);
      }
      dirtyAddrsRef.current = pairs;
      setDirtyAddrsTick((t) => t + 1);
    } else if (dirtyAddrsRef.current.length > 0) {
      // No writes in this snapshot (a non-storing step, or assemble/reset):
      // drop the previous frame's ranges so stale cells stop highlighting.
      dirtyAddrsRef.current = [];
      setDirtyAddrsTick((t) => t + 1);
    }
  }, [
    appendStderr,
    appendStdout,
    applyRegisters,
    codeBase,
    invalidateMemory,
    markCurrentLine,
    syncSeen,
  ]);

  // Ref and state move together so the guards (refs) and the controls
  // (state) can never disagree about whether a program exists.
  const markProgramLoaded = useCallback((loaded: boolean) => {
    programLoadedRef.current = loaded;
    setProgramLoaded(loaded);
  }, []);

  // Load backend on mount.
  useEffect(() => {
    let cancelled = false;
    const backend = pickBackend();
    backendRef.current = backend;
    const unsubscribe = backend.onSnapshot((snap) => {
      if (!cancelled) applySnapshot(snap);
    });
    backend
      .init()
      .then(async (snap) => {
        if (cancelled) return;
        applySnapshot(snap);
        const base = await backend.codeBase();
        if (cancelled) return;
        setCodeBase(base);
        // The address bands ride the same one-time round trip as codeBase:
        // fixed for the life of the module, so nothing re-reads them. The
        // table only labels a panel, so a failure degrades to the panel's
        // own section list instead of failing the whole boot.
        const regions = await backend.memoryMap().catch(() => []);
        if (cancelled) return;
        setMemoryRegions(regions);
        setIsLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // applySnapshot depends on codeBase but we want this to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assembleWith = useCallback(
    (
      source: string,
      args: string[],
      surfaceErrors: boolean,
    ): Promise<AssembleOutcome> => {
      const backend = backendRef.current;
      if (!backend) {
        return Promise.resolve({ success: false, error: "emulator not loaded", errorLine: null });
      }
      sourceRef.current = source;
      if (surfaceErrors) {
        setError(null);
        setAssemblyErrors([]);
        // Console scrollback and the step counter belong to the EDITOR's
        // debugging session. A terminal build (`gcc foo.s`, `./foo`) shares
        // the one machine but must not erase what the student was reading;
        // the terminal reports its own program's output as a delta instead.
        setStepCount(0);
        clearScrollback();
      } else {
        // The build still resets the machine's display counters to zero,
        // and a zeroed counter would unprint that reading. Reclassifying
        // the scrollback as history parks it out of the counters' reach.
        preserveScrollback();
      }
      // The backend wipes the machine on every assemble attempt, so the old
      // program is gone the moment one starts; the flag comes back only on
      // success. A failed assemble leaves the controls gated.
      markProgramLoaded(false);
      // The replay ring is the editor's scrubber history and seeking only
      // repaints React state (never the CPU), so a terminal build leaves it
      // standing beside the counter it belongs to.
      if (surfaceErrors) resetReplayHistory();
      // Drop any prior line map; a failed assemble or the bare-metal path
      // then falls back to the legacy line-count heuristic.
      lineMapRef.current = emptyLineMap();
      detectHostedMode(source).then(setHostedMode).catch(() => {});

      if (!hasAssemblableContent(source)) {
        if (surfaceErrors) setError("no instructions to assemble");
        setInstructions([]);
        return Promise.resolve({
          success: false,
          error: "no instructions to assemble",
          errorLine: null,
        });
      }

      // Return the promise chain so callers that must run only after the
      // backend has loaded the program (the embed/checker Run, which has no
      // separate Assemble control) can await assembly.
      // isAssembling drives the Assemble button's disabled "loading..."
      // state, which is the EDITOR's control: a terminal build flashing it
      // told the student their button was busy with work they never asked
      // for.
      if (surfaceErrors) setIsAssembling(true);
      return backend
        .assemble(source, args)
        .then(async ({ result }): Promise<AssembleOutcome> => {
          if (!result.success) {
            // A non-positive line means "no line available" (a few linker
            // errors); Monaco clamps a 0 range to line 1, which paints the
            // error onto an unrelated first line.
            const errorLine =
              result.error_line != null && result.error_line > 0 ? result.error_line : null;
            if (surfaceErrors) {
              const errors: AssemblyError[] = [];
              if (errorLine != null && result.error != null) {
                errors.push({ line: errorLine, message: result.error });
              }
              setAssemblyErrors(errors);
              setError(result.error ?? null);
            }
            return {
              success: false,
              error: result.error ?? null,
              errorLine,
            };
          }
          const base = await backend.codeBase();
          // Fetch the authoritative line map alongside codeBase (mirroring
          // the existing codeBase round-trip), parse it into addr<->line
          // lookups, and key the disassembly text off it for this assembly,
          // along with the marker and breakpoints through the ref.
          const flatMap = await backend.lineMap();
          const map = parseLineMap(flatMap);
          lineMapRef.current = map;
          const mapped = !isEmptyLineMap(map);
          // The gutter dots are re-keyed through the FRESH map; lines that
          // no longer resolve lose their dot.
          await rekeyAfterAssemble({ base, source, map });
          // The post-assemble snapshot was applied while the loaded flag was
          // still down (and before this map existed), so it left no marker.
          // Recompute the entry marker from the live PC now: through the map
          // when there is one, through the index fallback when the program
          // is bare-metal, so the entry frame highlights without a step.
          const entryPc = latestSnapRef.current.pc;
          const entryLine = mapped
            ? pcToSourceLineFromMap(entryPc, map)
            : pcToSourceLine((entryPc - base) / 4, source);
          markCurrentLine(entryLine);
          // One bulk read for the whole code region: a per-instruction loop
          // costs instruction_count worker round-trips per assemble.
          const codeBytes =
            result.instruction_count > 0
              ? await backend.getMemory(base, result.instruction_count * 4)
              : new Uint8Array(0);
          setInstructions(
            buildDisassembly({
              base,
              count: result.instruction_count,
              codeBytes,
              source,
              map,
            }),
          );
          markProgramLoaded(true);
          return { success: true, error: null, errorLine: null };
        })
        .catch((e: unknown): AssembleOutcome => {
          const message = e instanceof Error ? e.message : String(e);
          if (surfaceErrors) setError(message);
          return { success: false, error: message, errorLine: null };
        })
        .finally(() => {
          if (surfaceErrors) setIsAssembling(false);
        });
    },
    [
      clearScrollback,
      preserveScrollback,
      latestSnapRef,
      markCurrentLine,
      rekeyAfterAssemble,
      resetReplayHistory,
      markProgramLoaded,
    ],
  );

  const assemble = useCallback(
    (source: string, args: string[] = []): Promise<boolean> =>
      assembleWith(source, args, true).then((r) => r.success),
    [assembleWith],
  );

  // The terminal's gcc/as path: same machine bookkeeping, but the verdict
  // comes back directly (no stale state reads) and nothing is written to the
  // editor's error markers: the terminal's error belongs to the terminal's
  // file, not the source the editor happens to show.
  const assembleForTool = useCallback(
    (source: string, args: string[] = []): Promise<AssembleOutcome> =>
      assembleWith(source, args, false),
    [assembleWith],
  );

  /**
   * Surface a runtime stop with its editor line when the wasm side could
   * resolve one: the banner carries "line N" and the editor gets a line
   * marker, so a fault raised inside printf or a syscall points at the
   * call site instead of at nothing.
   */
  const surfaceRuntimeError = useCallback((message: string, line?: number | null) => {
    if (line != null && line > 0) {
      setError(`line ${line}: ${message}`);
      setAssemblyErrors([{ line, message }]);
    } else {
      setError(message);
    }
  }, []);

  const step = useCallback(() => {
    const backend = backendRef.current;
    // Gate on a loaded program (through the ref, like run) so the controls,
    // shortcuts, palette, and terminal all share one no-program guard.
    if (!backend || !programLoadedRef.current) return;
    setError(null);
    backend
      .step()
      .then(({ stepResult }) => {
        if (stepResult.error) surfaceRuntimeError(stepResult.error, stepResult.error_line);
        setStepCount((c) => {
          const next = c + 1;
          // currentLineRef + latestSnapRef are already updated because
          // notifyAndReturn fires the listener before the promise
          // resolves.
          pushReplayFrame(next);
          return next;
        });
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [pushReplayFrame, surfaceRuntimeError]);

  const stepBack = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || !programLoadedRef.current) return;
    setError(null);
    backend
      .stepBack()
      .then(() => setStepCount((c) => Math.max(0, c - 1)))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const loadState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    // A restored save is a live machine with a program in memory, so the
    // execution controls come back even when a reset preceded the load.
    // Any error banner describes a run the restored state never took.
    void backend.loadState(name).then(({ ok }) => {
      if (ok) {
        setError(null);
        markProgramLoaded(true);
      }
    });
  }, [markProgramLoaded]);

  const run = useCallback(() => {
    const backend = backendRef.current;
    // Guard through the refs, not state: callers that await an assemble
    // and then invoke a run captured earlier (the embed's Run, the
    // checker) must see the fresh post-assemble halt and loaded flags.
    // The in-flight guard stops a second concurrent loop (hold-F5, the
    // palette's Run) from stacking another 1M-step budget on the machine.
    if (!backend || !programLoadedRef.current || haltedRef.current) return;
    if (runningRef.current) return;
    setIsRunning(true);
    runningRef.current = true;
    const drive = async (): Promise<void> => {
      let total = 0;
      for (;;) {
        const { runResult } = await backend.runUntilBreak(1_000_000);
        // A run cancelled by reset/assemble describes a machine that no
        // longer exists; acting on it painted `unknown instruction:
        // 0x00000000` right after the student pressed Reset.
        if (runResult.cancelled) return;
        total += runResult.steps_executed;
        // A pacing pause (nanosleep): honor it in real time and keep the
        // same run going, unless pause/reset stood the drive down while
        // it waited. The steps so far still land on the counter below.
        if (
          runResult.sleep_ms != null &&
          !runResult.halted &&
          !runResult.error &&
          !runResult.hit_breakpoint
        ) {
          const ms = Math.max(1, Math.min(runResult.sleep_ms, 2000));
          await new Promise<void>((resolve) => setTimeout(resolve, ms));
          if (runningRef.current) continue;
        }
        setStepCount((c) => {
          const next = c + total;
          if (runResult.error) surfaceRuntimeError(runResult.error, runResult.error_line);
          else if (runResult.step_limit_reached) {
            setError(
              `paused after ${total.toLocaleString()} steps without finishing. ` +
                "press run to continue, or check for a loop whose exit condition never becomes true",
            );
          }
          // Approximate replay capture: only the final frame of the run
          // chunk is captured. Per-step granularity would require a
          // Rust delta in the snapshot.
          pushReplayFrame(next);
          return next;
        });
        return;
      }
    };
    drive()
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setIsRunning(false);
        runningRef.current = false;
      });
  }, [pushReplayFrame, surfaceRuntimeError]);

  const pause = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    runningRef.current = false;
    setIsRunning(false);
    void backend.pause();
  }, []);

  const reset = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    runningRef.current = false;
    setIsRunning(false);
    setError(null);
    setAssemblyErrors([]);
    setInstructions([]);
    // The marker's state clears, but the ref keeps describing the live CPU
    // until the next assemble re-derives both.
    setCurrentLine(null);
    clearScrollback();
    setStepCount(0);
    markProgramLoaded(false);
    resetReplayHistory();
    void backend.reset();
  }, [clearScrollback, setCurrentLine, resetReplayHistory, markProgramLoaded]);

  const restoreBookmark = useCallback(
    async (params: {
      source: string;
      args?: string;
      stdin?: string;
      stepCount: number;
    }): Promise<{ success: boolean; stepped: number }> => {
      const backend = backendRef.current;
      if (!backend) return { success: false, stepped: 0 };
      resetReplayHistory();
      // Tokenize with the shared quoting-aware parser, not a bare
      // whitespace split: a bookmarked `"hello world"` is one argv entry
      // everywhere else, so the restore must not split it into two.
      const argList = params.args ? parseArgs(params.args) : [];
      // One assemble path for every program delivery: a direct
      // backend.assemble call would skip the line-map refresh, hosted-mode
      // detection, the instruction decode, and the entry marker, leaving the
      // debugger describing the PREVIOUS program (both link at CODE_BASE, so
      // stale lookups hit rather than miss).
      const outcome = await assembleWith(params.source, argList, true);
      if (!outcome.success) return { success: false, stepped: 0 };
      if (params.stdin) {
        await backend.pushStdin(params.stdin);
      }
      // The persisted count is untrusted (an imported bundle passes a
      // bare typeof check); clamp it to the same ceiling run() uses.
      const target = Math.min(Math.max(0, Math.floor(params.stepCount)), 1_000_000);
      let stepped = 0;
      while (stepped < target) {
        const { stepResult } = await backend.step();
        stepped++;
        setStepCount(stepped);
        if (stepResult.halted || stepResult.error) break;
        if (stepResult.outcome === "waiting") break;
        // On the main-thread backend each await is only a microtask;
        // without a real yield this loop starves rendering and input
        // for the whole restore.
        if (stepped % 1024 === 0) {
          await new Promise<void>((r) => setTimeout(r, 0));
        }
      }
      pushReplayFrame(stepped);
      return { success: true, stepped };
    },
    [assembleWith, pushReplayFrame, resetReplayHistory],
  );

  // Memoized return so consumers' useCallback/useMemo dependents don't
  // see a fresh object every render.
  return useMemo(
    () => ({
      isLoaded,
      loadError,
      registers,
      fpRegisters,
      changedFpRegs,
      sp,
      pc,
      nzcv,
      changedRegs,
      isRunning,
      isAssembling,
      isHalted,
      programLoaded,
      error,
      assemblyErrors,
      breakpoints,
      currentLine,
      externalCall,
      instructions,
      codeBase,
      memoryRegions,
      stdout,
      stderr,
      blocked,
      wantsTerminal,
      setOutputTap,
      exitCode,
      hostedMode,
      vfsFiles,
      assemble,
      assembleForTool,
      step,
      stepBack,
      canStepBack,
      stepCount,
      savedStates,
      saveState,
      loadState,
      deleteState,
      run,
      pause,
      reset,
      toggleBreakpoint,
      clearAllBreakpoints,
      remapBreakpoints,
      getMemory,
      getMemoryMapped,
      pushStdin,
      closeStdin,
      setSnapshotsPaused,
      lint,
      uploadVfsFile,
      readVfsFile,
      deleteVfsFile,
      resolveLabel,
      m4Expand,
      setBreakpointAddress,
      clearBreakpointAddress,
      restoreBookmark,
      clearConsole,
      dirtyAddrs: dirtyAddrsRef.current,
      replayFrames: readReplayFrames(),
      seekReplay,
    }),
    // replayTick is intentionally a dep so consumers re-render when the
    // underlying replay ring mutates (the ref identity itself never
    // changes). eslint can't see that the returned `replayFrames` reads
    // through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoaded, loadError, registers, sp, pc, nzcv, changedRegs,
      isRunning, isAssembling, isHalted, programLoaded, error, assemblyErrors, breakpoints,
      currentLine, externalCall, instructions, codeBase, memoryRegions,
      stdout, stderr, blocked,
      wantsTerminal, setOutputTap,
      exitCode, hostedMode, vfsFiles, canStepBack, stepCount,
      savedStates, assemble, assembleForTool, step, stepBack, saveState, loadState,
      deleteState, run, pause, reset, toggleBreakpoint, clearAllBreakpoints, remapBreakpoints,
      getMemory, getMemoryMapped,
      pushStdin, closeStdin, lint, uploadVfsFile, readVfsFile, deleteVfsFile, resolveLabel,
      setBreakpointAddress, clearBreakpointAddress, restoreBookmark,
      clearConsole, replayTick, dirtyAddrsTick, seekReplay,
    ],
  );
}
