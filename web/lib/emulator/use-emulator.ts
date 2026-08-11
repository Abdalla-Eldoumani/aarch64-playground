"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickBackend, type EmulatorBackend } from "@/lib/emulator/backend";
import { detectHostedMode } from "@/lib/emulator/emulator";
import {
  emptyLineMap,
  isEmptyLineMap,
  lineToAddrFromMap,
  parseLineMap,
  pcToSourceLineFromMap,
  type LineMap,
} from "@/lib/emulator/line-map";
import type { MemoryRegion } from "@/lib/emulator/memory-map";
import { ReplayRing, type ReplayFrame } from "@/lib/emulator/replay";
import { parseArgs } from "@/lib/playground/args";
import type { ExternalCall, StateSnapshot } from "@/lib/worker/protocol";

export interface AssemblyError {
  line: number;
  message: string;
}

/** Retained console scrollback. The panel renders the whole string as one
 *  text node, so an unbounded buffer turns a print-happy runaway into
 *  seconds of layout jank per heartbeat; 256 KB is thousands of lines. */
export const MAX_CONSOLE_CHARS = 256 * 1024;
/** Visible marker so trimmed output is never mistaken for all of it. */
export const CONSOLE_TRIM_MARKER = "[...earlier output trimmed...]\n";

/** Append a delta to console scrollback, keeping only the newest
 *  MAX_CONSOLE_CHARS and saying so when older output is dropped. */
export function appendBounded(prev: string, delta: string): string {
  const next = prev + delta;
  if (next.length <= MAX_CONSOLE_CHARS) return next;
  return CONSOLE_TRIM_MARKER + next.slice(next.length - MAX_CONSOLE_CHARS);
}

/** The direct verdict of one assemble attempt, returned to tool callers
 *  (the terminal's gcc) so they never read error state that has not
 *  flushed through React yet. */
export interface AssembleOutcome {
  success: boolean;
  error: string | null;
  errorLine: number | null;
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
  /** d0-d31 as raw IEEE-754 bit patterns ("0x…"); [] until the loaded WASM
   *  ships the FP surface, which is the UI's cue to hide the d-view. */
  fpRegisters: string[];
  sp: string;
  pc: number;
  nzcv: number;
  changedRegs: Set<number>;
  changedFpRegs: Set<number>;
  isRunning: boolean;
  /** True while an assemble is in flight. The FIRST assemble also fetches
   *  and compiles the wasm inside the worker, which can take visible time
   *  on a cold load -- without this flag that first click looks like a
   *  hang. */
  isAssembling: boolean;
  isHalted: boolean;
  /** True only while a successfully assembled (or state-restored) program
   *  is in the machine. `run`, `step`, and `stepBack` are inert without
   *  one; reset and a failed assemble drop the flag. */
  programLoaded: boolean;
  error: string | null;
  assemblyErrors: AssemblyError[];
  breakpoints: Set<number>;
  currentLine: number | null;
  /**
   * The external call the paused pc sits inside, or null when the pc is one
   * of the program's own instructions. Non-null means `currentLine` is the
   * call SITE, not the executing address -- the three steps a hosted call
   * takes land on a trampoline and a synthetic stub, neither of which is a
   * line the student wrote. Always null while the program is running (a
   * full run passes through dozens of calls a second) and on wasm builds
   * that predate the export.
   */
  externalCall: ExternalCall | null;
  instructions: DecodedInstruction[];
  codeBase: number;
  /**
   * The emulator's address bands, read once at load. Empty on a wasm build
   * that predates the export, which is the memory panel's cue to fall back
   * to its own section list.
   */
  memoryRegions: MemoryRegion[];
  stdout: string;
  stderr: string;
  blocked: boolean;
  /** True once the running program put the terminal in raw mode; the
   *  terminal pane takes over I/O and the console stays quiet. */
  wantsTerminal: boolean;
  /** Route program stdout away from the console (into the terminal
   *  pane) while a tap is set; pass null to restore console routing. */
  setOutputTap: (tap: ((text: string) => void) | null) => void;
  exitCode: number | null;
  hostedMode: boolean;
  vfsFiles: string[];
  /** Resolves true on a successful assemble, false on any failure, so
   *  callers can chain work (input seeding, run) on a loaded program. */
  assemble: (source: string, args?: string[]) => Promise<boolean>;
  /** Assemble for the terminal toolchain: same machine bookkeeping, but
   *  the precise verdict comes back directly and the editor's error
   *  markers stay untouched. */
  assembleForTool: (source: string, args?: string[]) => Promise<AssembleOutcome>;
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
  /** Drop every breakpoint, gutter and CPU alike (program switch). */
  clearAllBreakpoints: () => void;
  /**
   * Move every stored gutter line through `remap` (null drops it). The
   * multi-file workspace keys breakpoints by COMBINED-string line, so an
   * edit that changes any file's length re-numbers them all; the playground
   * re-anchors them here rather than letting the next assemble arm an
   * address belonging to a different instruction.
   */
  remapBreakpoints: (remap: (line: number) => number | null) => void;
  /**
   * Returns the cached bytes for `[addr, addr + len)`. On a cache miss
   * the returned array is empty and an async fetch is queued; the next
   * render delivers the bytes via state. Memory panels render a
   * "loading" placeholder while empty.
   */
  getMemory: (addr: number, len: number) => Uint8Array;
  /** Whether the range is mapped: true/false once known, null while
   *  the async verdict is in flight (render a pending placeholder). */
  getMemoryMapped: (addr: number, len: number) => boolean | null;
  pushStdin: (s: string) => void;
  /** Pause/resume the step-back snapshot ring (terminal sessions). */
  setSnapshotsPaused: (paused: boolean) => void;
  /** Signal end-of-input (ctrl-d): getchar sees EOF, scanf finishes. */
  closeStdin: () => void;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  readVfsFile: (path: string) => Promise<Uint8Array>;
  deleteVfsFile: (path: string) => Promise<boolean>;
  resolveLabel: (name: string) => Promise<number | null>;
  /** Pre-assembly structural lint: advisory warnings with a line and a
   *  one-line remedy. Empty on a wasm build that predates the export. */
  lint: (source: string) => Promise<AssemblyError[]>;
  /** Standalone m4 pass for the terminal; null when the WASM predates it. */
  m4Expand: (source: string) => Promise<{ success: boolean; text?: string; error?: string; error_line?: number } | null>;
  /** Address-based breakpoint setter, used by `gdb b <label>` once the
   *  label resolves. The line-based `toggleBreakpoint` stays the
   *  primary path for the gutter UI. */
  setBreakpointAddress: (addr: number) => Promise<void>;
  clearBreakpointAddress: (addr: number) => Promise<void>;
  /**
   * Restore a named bookmark: assemble the saved source with the saved
   * args, push the saved stdin (if any), then step the live CPU forward
   * to `stepCount` (clamped to the run ceiling). Resolves a verdict --
   * `success` false means the saved source no longer assembles, and
   * `stepped` is how far the machine actually got (a halt, fault, or
   * input wait stops the walk early) so the caller reports the truth.
   */
  restoreBookmark: (params: {
    source: string;
    args?: string;
    stdin?: string;
    stepCount: number;
  }) => Promise<{ success: boolean; stepped: number }>;
  clearConsole: () => void;
  /**
   * Most-recent snapshot's `(addr, len)` memory writes. Drives the
   * replay scrubber's memory-diff highlighting and any future
   * "show me what changed last step" UI.
   */
  dirtyAddrs: Array<[number, number]>;
  /**
   * Last N captured frames for the replay scrubber. Populated after
   * every step and run stop. Capacity 128.
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
  // Parallel mapped-ness cache for the watch panel's fault display;
  // same per-frame lifetime as the byte cache.
  const mappedCacheRef = useRef<Map<string, boolean>>(new Map());
  const mappedPendingRef = useRef<Set<string>>(new Set());
  const currentLineRef = useRef<number | null>(null);
  // Authoritative linker address -> editor-line map for the current
  // assembly. Empty until the first successful hosted assemble; an empty
  // map signals the legacy source-text line-count fallback (bare-metal,
  // where instruction index and non-label source line are already 1:1).
  const lineMapRef = useRef<LineMap>(emptyLineMap());
  // Which gutter LINES share each armed CPU address. Labels, blanks, and
  // comments forward-resolve to the next instruction, so several dots can
  // legitimately share one address; the CPU breakpoint is cleared only
  // when the LAST of them goes.
  const bpLinesByAddrRef = useRef<Map<number, Set<number>>>(new Map());
  // Replay ring + the latest snapshot snapshot-cache so step/run callbacks
  // can read regs/pc/nzcv without piping them through React state and
  // racing the snapshot listener.
  const replayRingRef = useRef<ReplayRing>(new ReplayRing(128));
  const latestSnapRef = useRef<{
    registers: string[];
    sp: string;
    fpRegisters: string[];
    pc: number;
    nzcv: number;
    changedRegs: number[];
    changedFpRegs: number[];
  }>({
    registers: [],
    sp: "0x0000000080000000",
    fpRegisters: [],
    pc: 0,
    nzcv: 0,
    changedRegs: [],
    changedFpRegs: [],
  });
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
  const [registers, setRegisters] = useState<string[]>(
    () => Array(31).fill("0x0000000000000000"),
  );
  const [sp, setSp] = useState("0x0000000080000000");
  const [pc, setPc] = useState(0x400000);
  const [nzcv, setNzcv] = useState(0);
  const [changedRegs, setChangedRegs] = useState<Set<number>>(new Set());
  const [fpRegisters, setFpRegisters] = useState<string[]>([]);
  const [changedFpRegs, setChangedFpRegs] = useState<Set<number>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [isHalted, setIsHalted] = useState(false);
  const [programLoaded, setProgramLoaded] = useState(false);
  const [canStepBack, setCanStepBack] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assemblyErrors, setAssemblyErrors] = useState<AssemblyError[]>([]);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [externalCall, setExternalCall] = useState<ExternalCall | null>(null);
  const [instructions, setInstructions] = useState<DecodedInstruction[]>([]);
  const [codeBase, setCodeBase] = useState(0x400000);
  const [memoryRegions, setMemoryRegions] = useState<MemoryRegion[]>([]);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [wantsTerminal, setWantsTerminal] = useState(false);
  const wantsTerminalRef = useRef(false);
  const outputTapRef = useRef<((text: string) => void) | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [hostedMode, setHostedMode] = useState(false);
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [savedStates, setSavedStates] = useState<string[]>([]);
  // Tick increments whenever cache state changes so panels re-render.
  const [memTick, setMemTick] = useState(0);
  const [replayTick, setReplayTick] = useState(0);
  const [dirtyAddrsTick, setDirtyAddrsTick] = useState(0);

  const applySnapshot = useCallback((snap: StateSnapshot) => {
    if (snap.frame > frameRef.current) {
      frameRef.current = snap.frame;
      memCacheRef.current.clear();
      memPendingRef.current.clear();
      mappedCacheRef.current.clear();
      mappedPendingRef.current.clear();
      setMemTick((t) => t + 1);
    }
    setRegisters(snap.registers);
    setSp(snap.sp);
    const pcNum = Number(BigInt(snap.pc));
    setPc(pcNum);
    setNzcv(snap.nzcv);
    setChangedRegs(new Set(snap.changedRegs));
    setFpRegisters(snap.fpRegisters);
    setChangedFpRegs(new Set(snap.changedFpRegs));
    latestSnapRef.current = {
      registers: snap.registers,
      sp: snap.sp,
      fpRegisters: snap.fpRegisters,
      pc: pcNum,
      nzcv: snap.nzcv,
      changedRegs: snap.changedRegs,
      changedFpRegs: snap.changedFpRegs,
    };
    setIsHalted(snap.halted);
    haltedRef.current = snap.halted;
    setBlocked(snap.blocked);
    // A halted machine wants nothing: the emulator only ever SETS raw mode
    // (a termios call) and never clears it on exit, so a finished arcade
    // program left the flag up and kept stealing the terminal pane from the
    // next program -- and the console's blocked jump stood down for a read
    // no terminal session was there to answer.
    const wantsTerm = snap.wantsTerminal && !snap.halted;
    wantsTerminalRef.current = wantsTerm;
    setWantsTerminal(wantsTerm);
    setExitCode(snap.exitCode);
    setCanStepBack(snap.canStepBack);
    setVfsFiles(snap.vfsFiles);
    setSavedStates(snap.savedStates);
    if (snap.stdoutDelta) {
      // While the terminal pane holds the tap, program output belongs to
      // xterm; mirroring it into the console doubled every frame.
      const tap = outputTapRef.current;
      if (tap) tap(snap.stdoutDelta);
      else setStdout((prev) => appendBounded(prev, snap.stdoutDelta));
    }
    if (snap.stderrDelta) setStderr((prev) => appendBounded(prev, snap.stderrDelta));
    // Drive the current-line marker off the linker's authoritative
    // address->editor-line map: look the snapshot pc up directly instead
    // of counting non-label source lines (which double-counts data/macro
    // lines and drifts on complex programs). Fall back to the legacy
    // line-count path only when the map is empty (bare-metal, already 1:1).
    // No program, no marker: snapshots that arrive while the machine is
    // empty (boot heartbeats, reset, a failed assemble) must not resurrect
    // a stale line through the previous program's map.
    // An external call is a PAUSED-state affordance. A run passes through
    // one on every printf, so honoring it mid-run would strobe the card and
    // drag the marker back to the call site on every heartbeat; the pc the
    // run reports is the truth there.
    const call = (!runningRef.current && snap.externalCall) || null;
    setExternalCall(call);
    const map = lineMapRef.current;
    if (!programLoadedRef.current) {
      setCurrentLine(null);
      currentLineRef.current = null;
    } else if (call) {
      // Inside a libc call the pc is a trampoline word or a synthetic stub;
      // the line the student is on is the `bl` that got there (null when the
      // map cannot name it, which reads as "no line" exactly as before).
      setCurrentLine(call.callSiteLine);
      currentLineRef.current = call.callSiteLine;
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
    } else if (dirtyAddrsRef.current.length > 0) {
      // No writes in this snapshot (a non-storing step, or assemble/reset):
      // drop the previous frame's ranges so stale cells stop highlighting.
      dirtyAddrsRef.current = [];
      setDirtyAddrsTick((t) => t + 1);
    }
  }, [codeBase]);

  // Push a replay frame using the latest snapshot data + the
  // current line. Called by step / runUntilBreak after the snapshot
  // listener has updated currentLineRef + latestSnapRef.
  const pushReplayFrame = useCallback((newStepCount: number) => {
    const ln = currentLineRef.current;
    const snap = latestSnapRef.current;
    replayRingRef.current.push({
      stepCount: newStepCount,
      registers: snap.registers,
      sp: snap.sp,
      fpRegisters: snap.fpRegisters,
      pc: snap.pc,
      nzcv: snap.nzcv,
      changedRegs: snap.changedRegs,
      changedFpRegs: snap.changedFpRegs,
      currentLine: ln,
    });
    setReplayTick((t) => t + 1);
  }, []);

  // Ref and state move together so the guards (refs) and the controls
  // (state) can never disagree about whether a program exists.
  const markProgramLoaded = useCallback((loaded: boolean) => {
    programLoadedRef.current = loaded;
    setProgramLoaded(loaded);
  }, []);

  const resetReplayHistory = useCallback(() => {
    replayRingRef.current.clear();
    setReplayTick((t) => t + 1);
  }, []);

  const seekReplay = useCallback((frameIndex: number) => {
    const frame = replayRingRef.current.at(frameIndex);
    if (!frame) return;
    setRegisters(frame.registers);
    setSp(frame.sp);
    setFpRegisters(frame.fpRegisters);
    setPc(frame.pc);
    setNzcv(frame.nzcv);
    setChangedRegs(new Set(frame.changedRegs));
    setChangedFpRegs(new Set(frame.changedFpRegs));
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
        setStdout("");
        setStderr("");
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

      const hasContent = source
        .split("\n")
        .some((line) => {
          const trimmed = line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
          return trimmed.length > 0 && !trimmed.endsWith(":");
        });
      if (!hasContent) {
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
            // errors); Monaco clamps a 0 range to line 1, which painted
            // the error onto an innocent first line.
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
          // lookups, and key the disassembly text -- and, via the ref, the
          // marker and breakpoints -- off it for this assembly.
          const flatMap = await backend.lineMap();
          const map = parseLineMap(flatMap);
          lineMapRef.current = map;
          const mapped = !isEmptyLineMap(map);
          // Re-key the gutter breakpoints through the FRESH map: the CPU
          // deliberately keeps its address set across assemble, but those
          // addresses belong to the previous assembly of possibly
          // different source. Clear them all and re-arm the lines that
          // still resolve; lines that no longer map lose their dot.
          await backend.clearAllBreakpoints();
          bpLinesByAddrRef.current = new Map();
          setBreakpoints((prev) => {
            const survivors = new Set<number>();
            for (const line of prev) {
              const addr = mapped
                ? lineToAddrFromMap(line, map)
                : (() => {
                    const idx = sourceLineToInstrIndex(line, source);
                    return idx === null ? null : base + idx * 4;
                  })();
              if (addr === null) continue;
              survivors.add(line);
              const lines = bpLinesByAddrRef.current.get(addr) ?? new Set<number>();
              if (lines.size === 0) void backend.setBreakpoint(addr);
              lines.add(line);
              bpLinesByAddrRef.current.set(addr, lines);
            }
            return survivors;
          });
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
          // One bulk read for the whole code region: the per-instruction
          // loop used to make instruction_count sequential worker
          // round-trips on every assemble.
          const codeBytes =
            result.instruction_count > 0
              ? await backend.getMemory(base, result.instruction_count * 4)
              : new Uint8Array(0);
          // Both text lookups used to re-split the source (and re-run two
          // regexes per line) once PER INSTRUCTION, so the decode cost grew
          // with source x instructions: a dsav-sized workspace spent ~1s of
          // blocked main thread here and a 1 MB one minutes. Strip the
          // source once, then index it.
          const strippedLines = stripSourceLines(source);
          const instrTexts = indexedInstructionText(strippedLines);
          for (let i = 0; i < result.instruction_count; i++) {
            const addr = base + i * 4;
            const off = i * 4;
            const word =
              (codeBytes[off] ?? 0) |
              ((codeBytes[off + 1] ?? 0) << 8) |
              ((codeBytes[off + 2] ?? 0) << 16) |
              ((codeBytes[off + 3] ?? 0) << 24);
            const hex = "0x" + (word >>> 0).toString(16).padStart(8, "0");
            // The map gives the editor line for this instruction's
            // address; render that line's text. Fall back to the
            // index-based source text when the map is empty (bare-metal)
            // or the address is unexpectedly absent.
            let text: string;
            if (mapped) {
              const line = pcToSourceLineFromMap(addr, map);
              text =
                line == null
                  ? instrTexts[i] ?? ""
                  : strippedLines[line - 1] ?? "";
            } else {
              text = instrTexts[i] ?? "";
            }
            instrs.push({ address: addr, hex, text });
          }
          setInstructions(instrs);
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
    [resetReplayHistory, markProgramLoaded],
  );

  const assemble = useCallback(
    (source: string, args: string[] = []): Promise<boolean> =>
      assembleWith(source, args, true).then((r) => r.success),
    [assembleWith],
  );

  // The terminal's gcc/as path: same machine bookkeeping, but the verdict
  // comes back directly (no stale state reads) and nothing is written to
  // the editor's error markers -- the terminal's error belongs to the
  // terminal's file, not the source the editor happens to show.
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
    // Any error banner describes a run the restored state never took.
    void backend.loadState(name).then(({ ok }) => {
      if (ok) {
        setError(null);
        markProgramLoaded(true);
      }
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
              `paused after ${total.toLocaleString()} steps without finishing -- ` +
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
    setCurrentLine(null);
    setStdout("");
    setStderr("");
    setStepCount(0);
    markProgramLoaded(false);
    resetReplayHistory();
    void backend.reset();
  }, [resetReplayHistory, markProgramLoaded]);

  const pushStdin = useCallback((s: string) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.pushStdin(s);
  }, []);

  const setOutputTap = useCallback(
    (tap: ((text: string) => void) | null) => {
      outputTapRef.current = tap;
    },
    [],
  );

  const closeStdin = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.closeStdin();
  }, []);

  // Live terminal sessions pause the step-back ring: the per-step clone
  // costs more than the step, and stepping back mid-session has no
  // meaning. The drive resumes it when it stands down.
  const setSnapshotsPaused = useCallback((paused: boolean) => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.setSnapshotsPaused(paused);
  }, []);

  const lint = useCallback(async (source: string): Promise<AssemblyError[]> => {
    const backend = backendRef.current;
    if (!backend) return [];
    try {
      return await backend.lint(source);
    } catch {
      // Advisory only: a lint failure must never surface as a problem.
      return [];
    }
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

  const m4Expand = useCallback(async (source: string) => {
    const backend = backendRef.current;
    if (!backend) return null;
    return backend.m4Expand(source);
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
      // One assemble path for every program delivery: the direct
      // backend.assemble call this used to make skipped the line-map
      // refresh, hosted-mode detection, the instruction decode, and the
      // entry marker -- so the debugger kept describing the PREVIOUS
      // program (both link at CODE_BASE, so stale lookups hit rather
      // than miss).
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

  // Resolve an editor line to an instruction address via the
  // authoritative reverse map: a breakpoint on a label, blank, or
  // comment line lands on the next real instruction. Fall back to index
  // counting only when the map is empty (bare-metal, already 1:1).
  const resolveBreakpointAddr = useCallback((line: number): number | null => {
    const map = lineMapRef.current;
    if (!isEmptyLineMap(map)) {
      return lineToAddrFromMap(line, map);
    }
    const instrIndex = sourceLineToInstrIndex(line, sourceRef.current);
    return instrIndex === null ? null : codeBase + instrIndex * 4;
  }, [codeBase]);

  const toggleBreakpoint = useCallback((line: number) => {
    const backend = backendRef.current;
    if (!backend) return;
    const addr = resolveBreakpointAddr(line);
    if (addr === null) return;
    const byAddr = bpLinesByAddrRef.current;
    setBreakpoints((prev) => {
      const next = new Set(prev);
      const lines = byAddr.get(addr) ?? new Set<number>();
      if (next.has(line)) {
        next.delete(line);
        lines.delete(line);
        // Removing one of several dots sharing this instruction used to
        // silently disarm the CPU breakpoint under the dots that stayed.
        if (lines.size === 0) {
          byAddr.delete(addr);
          void backend.clearBreakpoint(addr);
        } else {
          byAddr.set(addr, lines);
        }
      } else {
        next.add(line);
        if (lines.size === 0) void backend.setBreakpoint(addr);
        lines.add(line);
        byAddr.set(addr, lines);
      }
      return next;
    });
  }, [resolveBreakpointAddr]);

  /** Re-number the gutter lines without touching the CPU: the armed
   *  addresses still describe the program currently in memory, and the
   *  assemble that follows an edit clears and re-arms them all anyway. */
  const remapBreakpoints = useCallback((remap: (line: number) => number | null) => {
    const moved = new Map<number, Set<number>>();
    for (const [addr, lines] of bpLinesByAddrRef.current) {
      const next = new Set<number>();
      for (const line of lines) {
        const to = remap(line);
        if (to != null) next.add(to);
      }
      if (next.size > 0) moved.set(addr, next);
    }
    bpLinesByAddrRef.current = moved;
    setBreakpoints((prev) => {
      const next = new Set<number>();
      for (const line of prev) {
        const to = remap(line);
        if (to != null) next.add(to);
      }
      return next;
    });
  }, []);

  /** Drop every breakpoint, gutter and CPU alike: a different program's
   *  dots and addresses must never survive into this one. */
  const clearAllBreakpoints = useCallback(() => {
    bpLinesByAddrRef.current = new Map();
    setBreakpoints(new Set());
    const backend = backendRef.current;
    if (backend) void backend.clearAllBreakpoints();
  }, []);

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

  // Same sync-read-over-async-cache shape as getMemory: null means the
  // verdict has not arrived yet; the watch panel renders a pending
  // placeholder instead of a fake 0.
  const getMemoryMapped = useCallback(
    (addr: number, len: number): boolean | null => {
      const backend = backendRef.current;
      if (!backend) return null;
      const key = memCacheKey(addr, len);
      const cached = mappedCacheRef.current.get(key);
      if (cached !== undefined) return cached;
      if (!mappedPendingRef.current.has(key)) {
        mappedPendingRef.current.add(key);
        backend
          .isRangeMapped(addr, len)
          .then((mapped) => {
            mappedCacheRef.current.set(key, mapped);
            mappedPendingRef.current.delete(key);
            setMemTick((t) => t + 1);
          })
          .catch(() => {
            mappedPendingRef.current.delete(key);
          });
      }
      return null;
    },
    // Same honest-dependency note as getMemory.
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
      replayFrames: replayRingRef.current.range(),
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

/**
 * Every source line with its comment stripped and trimmed, indexed by
 * 0-based line. One pass over the source; the disassembly loop indexes it
 * instead of re-splitting per instruction.
 */
export function stripSourceLines(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").replace(/;.*$/, "").trim());
}

/**
 * The instruction-index-ordered text: stripped lines with blanks and
 * label-only lines removed, so `[i]` is the i-th emitted instruction. The
 * bare-metal fallback (and the map's rare misses) index this.
 */
export function indexedInstructionText(strippedLines: string[]): string[] {
  const out: string[] = [];
  for (const line of strippedLines) {
    if (!line || line.endsWith(":")) continue;
    out.push(line);
  }
  return out;
}
