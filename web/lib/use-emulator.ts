"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickBackend, type EmulatorBackend } from "@/lib/backend";
import { detectHostedMode } from "@/lib/emulator";
import {
  emptyLineMap,
  isEmptyLineMap,
  lineToAddrFromMap,
  parseLineMap,
  pcToSourceLineFromMap,
  type LineMap,
} from "@/lib/line-map";
import { ReplayRing, type ReplayFrame } from "@/lib/replay";
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
  /** True only while a successfully assembled (or state-restored) program
   *  is in the machine. `run`, `step`, and `stepBack` are inert without
   *  one; reset and a failed assemble drop the flag. */
  programLoaded: boolean;
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
  /** Resolves true on a successful assemble, false on any failure, so
   *  callers can chain work (input seeding, run) on a loaded program. */
  assemble: (source: string, args?: string[]) => Promise<boolean>;
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
  readVfsFile: (path: string) => Promise<Uint8Array>;
  deleteVfsFile: (path: string) => Promise<boolean>;
  resolveLabel: (name: string) => Promise<number | null>;
  /** Address-based breakpoint setter, used by `gdb b <label>` once the
   *  label resolves. The line-based `toggleBreakpoint` stays the
   *  primary path for the gutter UI. */
  setBreakpointAddress: (addr: number) => Promise<void>;
  clearBreakpointAddress: (addr: number) => Promise<void>;
  /**
   * Restore a named bookmark: assemble the saved source with the saved
   * args, push the saved stdin (if any), then step the live CPU forward
   * to `stepCount`. The Promise resolves once the step loop completes
   * or stops early because the program halted / blocked. Used by the
   * bookmarks list "load" button.
   */
  restoreBookmark: (params: {
    source: string;
    args?: string;
    stdin?: string;
    stepCount: number;
  }) => Promise<void>;
  clearConsole: () => void;
  /**
   * Per-source-line execution counter. Increments by one for every
   * instruction the snapshot's `pcTrace` reports (granular both for
   * `step` and `runUntilBreak`); cleared on `reset` and `assemble`.
   * Drives the hotspot overlay.
   */
  lineCounts: Map<number, number>;
  /**
   * Most-recent snapshot's `(addr, len)` memory writes. Drives the
   * replay scrubber's memory-diff highlighting and any future
   * "show me what changed last step" UI.
   */
  dirtyAddrs: Array<[number, number]>;
  /**
   * Last N captured frames for the replay scrubber. Populated by the
   * same step/run path that bumps `lineCounts`. Capacity 128.
   */
  replayFrames: ReplayFrame[];
  /**
   * Apply a captured frame's registers/PC/currentLine to React state
   * for visual scrubbing. Does not touch the underlying CPU; the next
   * forward `step` resumes from the live PC.
   */
  seekReplay: (frameIndex: number) => void;
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
  // Authoritative linker address -> editor-line map for the current
  // assembly. Empty until the first successful hosted assemble; an empty
  // map signals the legacy source-text line-count fallback (bare-metal,
  // where instruction index and non-label source line are already 1:1).
  const lineMapRef = useRef<LineMap>(emptyLineMap());
  // Replay ring + the latest snapshot snapshot-cache so step/run callbacks
  // can read regs/pc/nzcv without piping them through React state and
  // racing the snapshot listener.
  const replayRingRef = useRef<ReplayRing>(new ReplayRing(128));
  const latestSnapRef = useRef<{ registers: string[]; pc: number; nzcv: number; changedRegs: number[] }>(
    { registers: [], pc: 0, nzcv: 0, changedRegs: [] },
  );
  // Most-recent snapshot's `(addr, len)` writes. Drives memory-cell
  // diff highlighting in the replay scrubber and MemoryPanel. Cleared
  // on assemble / reset.
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
  const [registers, setRegisters] = useState<string[]>(
    () => Array(31).fill("0x0000000000000000"),
  );
  const [sp, setSp] = useState("0x0000000080000000");
  const [pc, setPc] = useState(0x400000);
  const [nzcv, setNzcv] = useState(0);
  const [changedRegs, setChangedRegs] = useState<Set<number>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [isHalted, setIsHalted] = useState(false);
  const [programLoaded, setProgramLoaded] = useState(false);
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
  const [dirtyAddrsTick, setDirtyAddrsTick] = useState(0);

  const applySnapshot = useCallback((snap: StateSnapshot) => {
    if (snap.frame > frameRef.current) {
      frameRef.current = snap.frame;
      memCacheRef.current.clear();
      memPendingRef.current.clear();
      setMemTick((t) => t + 1);
    }
    setRegisters(snap.registers);
    setSp(snap.sp);
    const pcNum = Number(BigInt(snap.pc));
    setPc(pcNum);
    setNzcv(snap.nzcv);
    setChangedRegs(new Set(snap.changedRegs));
    latestSnapRef.current = {
      registers: snap.registers,
      pc: pcNum,
      nzcv: snap.nzcv,
      changedRegs: snap.changedRegs,
    };
    setIsHalted(snap.halted);
    haltedRef.current = snap.halted;
    setBlocked(snap.blocked);
    setExitCode(snap.exitCode);
    setCanStepBack(snap.canStepBack);
    setVfsFiles(snap.vfsFiles);
    setSavedStates(snap.savedStates);
    if (snap.stdoutDelta) setStdout((prev) => prev + snap.stdoutDelta);
    if (snap.stderrDelta) setStderr((prev) => prev + snap.stderrDelta);
    // Drive the current-line marker off the linker's authoritative
    // address->editor-line map: look the snapshot pc up directly instead
    // of counting non-label source lines (which double-counts data/macro
    // lines and drifts on complex programs). Fall back to the legacy
    // line-count path only when the map is empty (bare-metal, already 1:1).
    // No program, no marker: snapshots that arrive while the machine is
    // empty (boot heartbeats, reset, a failed assemble) must not resurrect
    // a stale line through the previous program's map.
    const map = lineMapRef.current;
    if (!programLoadedRef.current) {
      setCurrentLine(null);
      currentLineRef.current = null;
    } else if (!isEmptyLineMap(map)) {
      const newLine = pcToSourceLineFromMap(pcNum, map);
      setCurrentLine(newLine);
      currentLineRef.current = newLine;
    } else {
      const instrIndex = (pcNum - codeBase) / 4;
      if (instrIndex >= 0) {
        const newLine = pcToSourceLine(instrIndex, sourceRef.current);
        setCurrentLine(newLine);
        currentLineRef.current = newLine;
      }
    }
    // Trace-driven hotspot bumping. Each PC in pcTrace maps to a
    // source line via the same authoritative map; we bump the count for
    // every executed instruction (not just the snapshot's terminal PC).
    // This is the granular run-mode hotspot -- a long loop lights up
    // across all its lines, not just the final one.
    if (snap.pcTrace && snap.pcTrace.length > 0) {
      const counts = lineCountsRef.current;
      const mapped = !isEmptyLineMap(map);
      let mutated = false;
      for (const tracePc of snap.pcTrace) {
        let line: number | null;
        if (mapped) {
          line = pcToSourceLineFromMap(tracePc, map);
        } else {
          const idx = (tracePc - codeBase) / 4;
          line = idx < 0 ? null : pcToSourceLine(idx, sourceRef.current);
        }
        if (line == null) continue;
        counts.set(line, (counts.get(line) ?? 0) + 1);
        mutated = true;
      }
      if (mutated) setLineCountsTick((t) => t + 1);
    }
    // dirtyAddrs are surfaced through a separate ref so the memory
    // panel + replay scrubber can highlight changed cells without
    // forcing a full memory cache invalidation.
    if (snap.dirtyAddrs && snap.dirtyAddrs.length > 0) {
      // The flat array is `[addr, len, addr, len, ...]`. Stash as
      // pairs; the consumer (replay scrubber + memory panel) reads
      // them out via `dirtyAddrs` on the hook return.
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i + 1 < snap.dirtyAddrs.length; i += 2) {
        pairs.push([snap.dirtyAddrs[i], snap.dirtyAddrs[i + 1]]);
      }
      dirtyAddrsRef.current = pairs;
      setDirtyAddrsTick((t) => t + 1);
    }
  }, [codeBase]);

  // Push a replay frame using the latest snapshot data + the
  // current line. Called by step / runUntilBreak after the snapshot
  // listener has updated currentLineRef + latestSnapRef. The
  // hotspot heat map now drives off the snapshot's `pcTrace` field
  // (handled inside applySnapshot) so this function does NOT bump
  // lineCounts -- it would double-count.
  const bumpLineCount = useCallback((newStepCount: number) => {
    const ln = currentLineRef.current;
    const snap = latestSnapRef.current;
    replayRingRef.current.push({
      stepCount: newStepCount,
      registers: snap.registers,
      pc: snap.pc,
      nzcv: snap.nzcv,
      changedRegs: snap.changedRegs,
      currentLine: ln,
    });
    setLineCountsTick((t) => t + 1);
  }, []);

  // Ref and state move together so the guards (refs) and the controls
  // (state) can never disagree about whether a program exists.
  const markProgramLoaded = useCallback((loaded: boolean) => {
    programLoadedRef.current = loaded;
    setProgramLoaded(loaded);
  }, []);

  const resetLineCounts = useCallback(() => {
    lineCountsRef.current = new Map();
    replayRingRef.current.clear();
    setLineCountsTick((t) => t + 1);
  }, []);

  const seekReplay = useCallback((frameIndex: number) => {
    const frame = replayRingRef.current.at(frameIndex);
    if (!frame) return;
    setRegisters(frame.registers);
    setPc(frame.pc);
    setNzcv(frame.nzcv);
    setChangedRegs(new Set(frame.changedRegs));
    setCurrentLine(frame.currentLine);
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
    (source: string, args: string[] = []): Promise<boolean> => {
      const backend = backendRef.current;
      if (!backend) return Promise.resolve(false);
      sourceRef.current = source;
      setError(null);
      setAssemblyErrors([]);
      setIsRunning(false);
      runningRef.current = false;
      setStepCount(0);
      setStdout("");
      setStderr("");
      // The backend wipes the machine on every assemble attempt, so the old
      // program is gone the moment one starts; the flag comes back only on
      // success. A failed assemble leaves the controls gated.
      markProgramLoaded(false);
      resetLineCounts();
      // Drop any prior line map; a failed assemble or the bare-metal path
      // then falls back to the legacy line-count heuristic.
      lineMapRef.current = emptyLineMap();
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
        return Promise.resolve(false);
      }

      // Return the promise chain so callers that must run only after the
      // backend has loaded the program (the embed/checker Run, which has no
      // separate Assemble control) can await assembly.
      return backend
        .assemble(source, args)
        .then(async ({ result }) => {
          if (!result.success) {
            const errors: AssemblyError[] = [];
            if (result.error_line != null && result.error != null) {
              errors.push({ line: result.error_line, message: result.error });
            }
            setAssemblyErrors(errors);
            setError(result.error ?? null);
            return false;
          }
          const base = await backend.codeBase();
          // Fetch the authoritative line map alongside codeBase (mirroring
          // the existing codeBase round-trip), parse it into addr<->line
          // lookups, and key the disassembly text -- and, via the ref, the
          // marker and breakpoints -- off it for this assembly.
          const flatMap = await backend.lineMap();
          const map = parseLineMap(flatMap);
          lineMapRef.current = map;
          const mapped = !isEmptyLineMap(map);
          // The post-assemble snapshot was applied while the loaded flag was
          // still down (and before this map existed), so it left no marker.
          // Recompute the entry marker from the live PC now: through the map
          // when there is one, through the index fallback when the program
          // is bare-metal, so the entry frame highlights without a step.
          const entryPc = latestSnapRef.current.pc;
          const entryLine = mapped
            ? pcToSourceLineFromMap(entryPc, map)
            : pcToSourceLine((entryPc - base) / 4, source);
          setCurrentLine(entryLine);
          currentLineRef.current = entryLine;
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
            // The map gives the editor line for this instruction's
            // address; render that line's text. Fall back to the
            // index-based source text when the map is empty (bare-metal)
            // or the address is unexpectedly absent.
            let text: string;
            if (mapped) {
              const line = pcToSourceLineFromMap(addr, map);
              text = line == null ? getSourceLineText(i, source) : sourceLineText(source, line);
            } else {
              text = getSourceLineText(i, source);
            }
            instrs.push({ address: addr, hex, text });
          }
          setInstructions(instrs);
          markProgramLoaded(true);
          return true;
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
          return false;
        });
    },
    [resetLineCounts, markProgramLoaded],
  );

  const step = useCallback(() => {
    const backend = backendRef.current;
    // Gate on a loaded program (through the ref, like run) so the controls,
    // shortcuts, palette, and terminal all share one no-program guard.
    if (!backend || !programLoadedRef.current) return;
    setError(null);
    backend
      .step()
      .then(({ stepResult }) => {
        if (stepResult.error) setError(stepResult.error);
        setStepCount((c) => {
          const next = c + 1;
          // currentLineRef + latestSnapRef are already updated because
          // notifyAndReturn fires the listener before the promise
          // resolves.
          bumpLineCount(next);
          return next;
        });
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [bumpLineCount]);

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

  const saveState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend || !name) return;
    void backend.saveState(name);
  }, []);

  const loadState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    // A restored save is a live machine with a program in memory, so the
    // execution controls come back even when a reset preceded the load.
    void backend.loadState(name).then(({ ok }) => {
      if (ok) markProgramLoaded(true);
    });
  }, [markProgramLoaded]);

  const deleteState = useCallback((name: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.deleteState(name);
  }, []);

  const run = useCallback(() => {
    const backend = backendRef.current;
    // Guard through the refs, not state: callers that await an assemble
    // and then invoke a run captured earlier (the embed's Run, the
    // checker) must see the fresh post-assemble halt and loaded flags.
    if (!backend || !programLoadedRef.current || haltedRef.current) return;
    setIsRunning(true);
    runningRef.current = true;
    backend
      .runUntilBreak(1_000_000)
      .then(({ runResult }) => {
        setStepCount((c) => {
          const next = c + runResult.steps_executed;
          if (runResult.error) setError(runResult.error);
          // Approximate hotspot + replay capture: only the final frame
          // of the run chunk is captured. Per-step granularity would
          // require a Rust delta in the snapshot; tracked in BACKLOG.
          bumpLineCount(next);
          return next;
        });
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setIsRunning(false);
        runningRef.current = false;
      });
  }, [bumpLineCount]);

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
    markProgramLoaded(false);
    resetLineCounts();
    void backend.reset();
  }, [resetLineCounts, markProgramLoaded]);

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

  const readVfsFile = useCallback(async (path: string) => {
    const backend = backendRef.current;
    if (!backend) return new Uint8Array();
    return backend.readVfsFile(path);
  }, []);

  const deleteVfsFile = useCallback(async (path: string) => {
    const backend = backendRef.current;
    if (!backend) return false;
    const result = await backend.deleteVfsFile(path);
    return result.removed;
  }, []);

  const resolveLabel = useCallback(async (name: string) => {
    const backend = backendRef.current;
    if (!backend) return null;
    return backend.resolveLabel(name);
  }, []);

  const setBreakpointAddress = useCallback(async (addr: number) => {
    const backend = backendRef.current;
    if (!backend) return;
    await backend.setBreakpoint(addr);
  }, []);

  const clearBreakpointAddress = useCallback(async (addr: number) => {
    const backend = backendRef.current;
    if (!backend) return;
    await backend.clearBreakpoint(addr);
  }, []);

  const restoreBookmark = useCallback(
    async (params: { source: string; args?: string; stdin?: string; stepCount: number }) => {
      const backend = backendRef.current;
      if (!backend) return;
      // Reset frontend state in the same shape `assemble` does, then
      // drive the backend through the bookmark-recorded sequence:
      // assemble -> push stdin -> step N times.
      sourceRef.current = params.source;
      setError(null);
      setAssemblyErrors([]);
      setStepCount(0);
      setStdout("");
      setStderr("");
      // Same gate discipline as assemble: the backend call below wipes the
      // machine, so the flag drops now and returns only on success.
      markProgramLoaded(false);
      resetLineCounts();
      const argList = params.args
        ? params.args.split(/\s+/).filter((s) => s.length > 0)
        : [];
      const { result } = await backend.assemble(params.source, argList);
      if (!result.success) {
        if (result.error_line != null && result.error != null) {
          setAssemblyErrors([{ line: result.error_line, message: result.error }]);
        }
        setError(result.error ?? null);
        return;
      }
      markProgramLoaded(true);
      if (params.stdin) {
        await backend.pushStdin(params.stdin);
      }
      // Step in chunks rather than one-step-per-await to keep the round
      // trip cost bounded. runUntilBreak has chunking already, but it
      // doesn't accept a stop-at-step-N argument; the per-step loop
      // gives the most precise restoration semantics.
      let stepped = 0;
      while (stepped < params.stepCount) {
        const { stepResult } = await backend.step();
        stepped++;
        setStepCount(stepped);
        if (stepResult.halted || stepResult.error) break;
        if (stepResult.outcome === "waiting") break;
      }
      bumpLineCount(stepped);
    },
    [bumpLineCount, resetLineCounts, markProgramLoaded],
  );

  const toggleBreakpoint = useCallback((line: number) => {
    const backend = backendRef.current;
    if (!backend) return;
    // Resolve the editor line to an instruction address via the
    // authoritative reverse map: a breakpoint on a label, blank, or
    // comment line lands on the next real instruction. Fall back to index
    // counting only when the map is empty (bare-metal, already 1:1).
    const map = lineMapRef.current;
    let resolved: number | null;
    if (!isEmptyLineMap(map)) {
      resolved = lineToAddrFromMap(line, map);
    } else {
      const instrIndex = sourceLineToInstrIndex(line, sourceRef.current);
      resolved = instrIndex === null ? null : codeBase + instrIndex * 4;
    }
    if (resolved === null) return;
    const addr = resolved;
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
      programLoaded,
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
      readVfsFile,
      deleteVfsFile,
      resolveLabel,
      setBreakpointAddress,
      clearBreakpointAddress,
      restoreBookmark,
      clearConsole,
      lineCounts: lineCountsRef.current,
      dirtyAddrs: dirtyAddrsRef.current,
      replayFrames: replayRingRef.current.range(),
      seekReplay,
    }),
    // lineCountsTick is intentionally a dep so consumers re-render when
    // the underlying lineCountsRef mutates (the ref identity itself
    // never changes). eslint can't see that the returned `lineCounts`
    // points at the ref's current value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoaded, loadError, registers, sp, pc, nzcv, changedRegs,
      isRunning, isHalted, programLoaded, error, assemblyErrors, breakpoints,
      currentLine, instructions, codeBase, stdout, stderr, blocked,
      exitCode, hostedMode, vfsFiles, canStepBack, stepCount,
      savedStates, assemble, step, stepBack, saveState, loadState,
      deleteState, run, pause, reset, toggleBreakpoint, getMemory,
      pushStdin, uploadVfsFile, readVfsFile, deleteVfsFile, resolveLabel,
      setBreakpointAddress, clearBreakpointAddress, restoreBookmark,
      clearConsole, lineCountsTick, dirtyAddrsTick, seekReplay,
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

// Text of a specific 1-based editor line, comments stripped and trimmed
// to match the display shape of `getSourceLineText`. Used when the
// authoritative line map provides the editor line for an instruction
// address, so the disassembly text tracks the real instruction rather
// than the index-counted source line.
function sourceLineText(source: string, lineNo: number): string {
  const raw = source.split("\n")[lineNo - 1];
  if (raw == null) return "";
  return raw.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
}
