"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickBackend, type EmulatorBackend } from "@/lib/backend";
import { detectHostedMode } from "@/lib/emulator";
import type { StateSnapshot } from "@/lib/worker/protocol";

export interface AssemblyError {
  line: number;
  message: string;
}

export interface DecodedInstruction {
  address: number;
  hex: string;
  text: string;
}

export interface EmulatorState {
  isLoaded: boolean;
  loadError: string | null;
  registers: string[];
  sp: string;
  pc: number;
  nzcv: number;
  changedRegs: Set<number>;
  isRunning: boolean;
  isHalted: boolean;
  error: string | null;
  assemblyErrors: AssemblyError[];
  breakpoints: Set<number>;
  currentLine: number | null;
  instructions: DecodedInstruction[];
  codeBase: number;
  stdout: string;
  stderr: string;
  blocked: boolean;
  exitCode: number | null;
  hostedMode: boolean;
  vfsFiles: string[];
  assemble: (source: string, args?: string[]) => void;
  step: () => void;
  stepBack: () => void;
  canStepBack: boolean;
  stepCount: number;
  savedStates: string[];
  saveState: (name: string) => void;
  loadState: (name: string) => void;
  deleteState: (name: string) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  toggleBreakpoint: (line: number) => void;
  /**
   * Returns the cached bytes for `[addr, addr + len)`. On a cache miss
   * the returned array is empty and an async fetch is queued; the next
   * render delivers the bytes via state. Memory panels render a
   * "loading" placeholder while empty.
   */
  getMemory: (addr: number, len: number) => Uint8Array;
  pushStdin: (s: string) => void;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  clearConsole: () => void;
  /**
   * Per-source-line execution counter. Increments by one each time a
   * `step` / `runUntilBreak` settles on a new line; cleared on
   * `reset` and `assemble`. Used by the hotspot overlay. Approximate
   * during run-mode (only the final line of each chunk is captured)
   * because the snapshot stream doesn't carry per-step line history.
   */
  lineCounts: Map<number, number>;
}

function memCacheKey(addr: number, len: number): string {
  return `${addr}:${len}`;
}

export function useEmulator(): EmulatorState {
  const backendRef = useRef<EmulatorBackend | null>(null);
  const runningRef = useRef(false);
  const sourceRef = useRef("");
  const frameRef = useRef(0);
  // Per-frame memory cache. Cleared when the worker bumps `frame`, so
  // panels never read stale bytes. Stores Uint8Arrays keyed by addr+len.
  const memCacheRef = useRef<Map<string, Uint8Array>>(new Map());
  const memPendingRef = useRef<Set<string>>(new Set());
  // Hotspot tracking. Source of truth lives in a ref so applySnapshot
  // can write without forcing the hook to render every snapshot. Tick
  // bump triggers consumers to re-read.
  const lineCountsRef = useRef<Map<number, number>>(new Map());
  const currentLineRef = useRef<number | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registers, setRegisters] = useState<string[]>(
    () => Array(31).fill("0x0000000000000000"),
  );
  const [sp, setSp] = useState("0x0000000080000000");
  const [pc, setPc] = useState(0x400000);
  const [nzcv, setNzcv] = useState(0);
  const [changedRegs, setChangedRegs] = useState<Set<number>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [isHalted, setIsHalted] = useState(false);
  const [canStepBack, setCanStepBack] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<AssemblyError[]>([]);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<DecodedInstruction[]>([]);
  const [codeBase, setCodeBase] = useState(0x400000);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hostedMode, setHostedMode] = useState(false);
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [savedStates, setSavedStates] = useState<string[]>([]);
  // Tick increments whenever cache state changes so panels re-render.
  const [memTick, setMemTick] = useState(0);
  const [lineCountsTick, setLineCountsTick] = useState(0);

  const applySnapshot = useCallback((snap: StateSnapshot) => {
    if (snap.frame > frameRef.current) {
      frameRef.current = snap.frame;
      memCacheRef.current.clear();
      memPendingRef.current.clear();
      setMemTick((t) => t + 1);
    }
    setRegisters(snap.registers);
    setSp(snap.sp);
    setPc(Number(BigInt(snap.pc)));
    setNzcv(snap.nzcv);
    setChangedRegs(new Set(snap.changedRegs));
    setIsHalted(snap.halted);
    setBlocked(snap.blocked);
    setExitCode(snap.exitCode);
    setCanStepBack(snap.canStepBack);
    setVfsFiles(snap.vfsFiles);
    setSavedStates(snap.savedStates);
    if (snap.stdoutDelta) setStdout((prev) => prev + snap.stdoutDelta);
    if (snap.stderrDelta) setStderr((prev) => prev + snap.stderrDelta);
    const instrIndex = (Number(BigInt(snap.pc)) - codeBase) / 4;
    if (instrIndex >= 0) {
      const newLine = pcToSourceLine(instrIndex, sourceRef.current);
      setCurrentLine(newLine);
      currentLineRef.current = newLine;
    }
  }, [codeBase]);

  // Bump the per-line execution counter for the current line. Called
  // by step / runUntilBreak after the snapshot listener has updated
  // currentLineRef. Caller is responsible for triggering the React
  // re-render via the tick state.
  const bumpLineCount = useCallback(() => {
    const ln = currentLineRef.current;
    if (ln == null) return;
    lineCountsRef.current.set(ln, (lineCountsRef.current.get(ln) ?? 0) + 1);
    setLineCountsTick((t) => t + 1);
  }, []);

  const resetLineCounts = useCallback(() => {
    lineCountsRef.current = new Map();
    setLineCountsTick((t) => t + 1);
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

  const assemble = useCallback(
    (source: string, args: string[] = []) => {
      const backend = backendRef.current;
      if (!backend) return;
      sourceRef.current = source;
      setError(null);
      setAssemblyErrors([]);
      setIsRunning(false);
      runningRef.current = false;
      setStepCount(0);
      setStdout("");
      setStderr("");
      resetLineCounts();
      detectHostedMode(source).then(setHostedMode).catch(() => {});

      const hasContent = source
        .split("\n")
        .some((line) => {
          const trimmed = line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
          return trimmed.length > 0 && !trimmed.endsWith(":");
        });
      if (!hasContent) {
        setError("no instructions to assemble");
        setInstructions([]);
        return;
      }

      backend
        .assemble(source, args)
        .then(async ({ result }) => {
          if (!result.success) {
            const errors: AssemblyError[] = [];
            if (result.error_line != null && result.error != null) {
              errors.push({ line: result.error_line, message: result.error });
            }
            setAssemblyErrors(errors);
            setError(result.error ?? null);
            return;
          }
          const base = await backend.codeBase();
          const instrs: DecodedInstruction[] = [];
          for (let i = 0; i < result.instruction_count; i++) {
            const addr = base + i * 4;
            const bytes = await backend.getMemory(addr, 4);
            const word =
              (bytes[0] ?? 0) |
              ((bytes[1] ?? 0) << 8) |
              ((bytes[2] ?? 0) << 16) |
              ((bytes[3] ?? 0) << 24);
            const hex = "0x" + (word >>> 0).toString(16).padStart(8, "0");
            const srcLine = getSourceLineText(i, source);
            instrs.push({ address: addr, hex, text: srcLine });
          }
          setInstructions(instrs);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [resetLineCounts],
  );

  const step = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    setError(null);
    backend
      .step()
      .then(({ stepResult }) => {
        if (stepResult.error) setError(stepResult.error);
        setStepCount((c) => c + 1);
        bumpLineCount();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [bumpLineCount]);

  const stepBack = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    setError(null);
    backend
      .stepBack()
      .then(() => setStepCount((c) => Math.max(0, c - 1)))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const saveState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend || !name) return;
    void backend.saveState(name);
  }, []);

  const loadState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.loadState(name);
  }, []);

  const deleteState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.deleteState(name);
  }, []);

  const run = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || isHalted) return;
    setIsRunning(true);
    runningRef.current = true;
    backend
      .runUntilBreak(1_000_000)
      .then(({ runResult }) => {
        setStepCount((c) => c + runResult.steps_executed);
        if (runResult.error) setError(runResult.error);
        // Approximate hotspot bump: only the final line of the run
        // chunk is captured. Per-step granularity would require a Rust
        // delta in the snapshot; tracked in BACKLOG.
        bumpLineCount();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setIsRunning(false);
        runningRef.current = false;
      });
  }, [isHalted, bumpLineCount]);

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
    setCurrentLine(null);
    setStdout("");
    setStderr("");
    setStepCount(0);
    resetLineCounts();
    void backend.reset();
  }, [resetLineCounts]);

  const pushStdin = useCallback((s: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.pushStdin(s);
  }, []);

  const uploadVfsFile = useCallback((path: string, data: Uint8Array) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.uploadVfsFile(path, data);
  }, []);

  const clearConsole = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    setStdout("");
    setStderr("");
    void backend.clearConsole();
  }, []);

  const toggleBreakpoint = useCallback((line: number) => {
    const backend = backendRef.current;
    if (!backend) return;
    const instrIndex = sourceLineToInstrIndex(line, sourceRef.current);
    if (instrIndex === null) return;
    const addr = codeBase + instrIndex * 4;
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
        void backend.clearBreakpoint(addr);
      } else {
        next.add(line);
        void backend.setBreakpoint(addr);
      }
      return next;
    });
  }, [codeBase]);

  // Synchronous read from the per-frame cache. On a miss we kick off
  // an async fetch; the next snapshot/heartbeat will trigger a re-
  // render with the bytes available.
  const getMemory = useCallback(
    (addr: number, len: number): Uint8Array => {
      const backend = backendRef.current;
      if (!backend) return new Uint8Array(len);
      const key = memCacheKey(addr, len);
      const cached = memCacheRef.current.get(key);
      if (cached) return cached;
      if (!memPendingRef.current.has(key)) {
        memPendingRef.current.add(key);
        backend
          .getMemory(addr, len)
          .then((bytes) => {
            memCacheRef.current.set(key, bytes);
            memPendingRef.current.delete(key);
            setMemTick((t) => t + 1);
          })
          .catch(() => {
            memPendingRef.current.delete(key);
          });
      }
      return new Uint8Array(len);
    },
    // memTick included so React knows this callback closure should
    // re-fire on cache invalidation; not strictly required since the
    // cache lives in refs but keeps the dependency set honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memTick],
  );

  // Memoized return so consumers' useCallback/useMemo dependents don't
  // see a fresh object every render.
  return useMemo(
    () => ({
      isLoaded,
      loadError,
      registers,
      sp,
      pc,
      nzcv,
      changedRegs,
      isRunning,
      isHalted,
      error,
      assemblyErrors,
      breakpoints,
      currentLine,
      instructions,
      codeBase,
      stdout,
      stderr,
      blocked,
      exitCode,
      hostedMode,
      vfsFiles,
      assemble,
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
      getMemory,
      pushStdin,
      uploadVfsFile,
      clearConsole,
      lineCounts: lineCountsRef.current,
    }),
    // lineCountsTick is intentionally a dep so consumers re-render when
    // the underlying lineCountsRef mutates (the ref identity itself
    // never changes). eslint can't see that the returned `lineCounts`
    // points at the ref's current value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoaded, loadError, registers, sp, pc, nzcv, changedRegs,
      isRunning, isHalted, error, assemblyErrors, breakpoints,
      currentLine, instructions, codeBase, stdout, stderr, blocked,
      exitCode, hostedMode, vfsFiles, canStepBack, stepCount,
      savedStates, assemble, step, stepBack, saveState, loadState,
      deleteState, run, pause, reset, toggleBreakpoint, getMemory,
      pushStdin, uploadVfsFile, clearConsole, lineCountsTick,
    ],
  );
}

// ---------------------------------------------------------------------------
// helpers: map between source lines and instruction indices
// ---------------------------------------------------------------------------

function pcToSourceLine(instrIndex: number, source: string): number | null {
  const lines = source.split("\n");
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
    if (!trimmed || trimmed.endsWith(":")) continue;
    if (idx === instrIndex) return i + 1;
    idx++;
  }
  return null;
}

function sourceLineToInstrIndex(
  line: number,
  source: string,
): number | null {
  const lines = source.split("\n");
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
    if (!trimmed || trimmed.endsWith(":")) continue;
    if (i + 1 === line) return idx;
    idx++;
  }
  return null;
}

function getSourceLineText(instrIndex: number, source: string): string {
  const lines = source.split("\n");
  let idx = 0;
  for (const line of lines) {
    const trimmed = line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
    if (!trimmed || trimmed.endsWith(":")) continue;
    if (idx === instrIndex) return trimmed;
    idx++;
  }
  return "";
}
