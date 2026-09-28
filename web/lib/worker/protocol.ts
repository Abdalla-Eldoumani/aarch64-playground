/**
 * Messages between the main thread and the emulator worker, an async copy of
 * the EmulatorInstance surface. A reply echoes its request's id; heartbeats
 * (id -1) carry a fresh snapshot so panels update during a run.
 */

export type RequestKind =
  | "init"
  | "assemble"
  | "step"
  | "stepBack"
  | "runUntilBreak"
  | "pause"
  | "reset"
  | "pushStdin"
  | "closeStdin"
  | "setSnapshotsPaused"
  | "takeStdout"
  | "takeStderr"
  | "getMemory"
  | "isRangeMapped"
  | "getSnapshot"
  | "setBreakpoint"
  | "clearBreakpoint"
  | "clearAllBreakpoints"
  | "saveState"
  | "loadState"
  | "deleteState"
  | "listStates"
  | "uploadVfsFile"
  | "listVfsFiles"
  | "readVfsFile"
  | "deleteVfsFile"
  | "resolveLabel"
  | "m4Expand"
  | "lint"
  | "clearConsole"
  | "codeBase"
  | "lineMap"
  | "memoryMap";

export interface BaseRequest<K extends RequestKind> {
  id: number;
  kind: K;
}

export type Request =
  | BaseRequest<"init">
  | (BaseRequest<"assemble"> & { source: string; args: string[] })
  | BaseRequest<"step">
  | BaseRequest<"stepBack">
  | (BaseRequest<"runUntilBreak"> & { maxSteps: number })
  | BaseRequest<"pause">
  | BaseRequest<"reset">
  | (BaseRequest<"pushStdin"> & { text: string; interactive?: boolean })
  | BaseRequest<"closeStdin">
  | (BaseRequest<"setSnapshotsPaused"> & { paused: boolean })
  | BaseRequest<"takeStdout">
  | BaseRequest<"takeStderr">
  | (BaseRequest<"getMemory"> & { addr: number; len: number })
  | (BaseRequest<"isRangeMapped"> & { addr: number; len: number })
  | BaseRequest<"getSnapshot">
  | (BaseRequest<"setBreakpoint"> & { addr: number })
  | (BaseRequest<"clearBreakpoint"> & { addr: number })
  | BaseRequest<"clearAllBreakpoints">
  | (BaseRequest<"saveState"> & { name: string })
  | (BaseRequest<"loadState"> & { name: string })
  | (BaseRequest<"deleteState"> & { name: string })
  | BaseRequest<"listStates">
  | (BaseRequest<"uploadVfsFile"> & { path: string; data: Uint8Array })
  | BaseRequest<"listVfsFiles">
  | (BaseRequest<"readVfsFile"> & { path: string })
  | (BaseRequest<"deleteVfsFile"> & { path: string })
  | (BaseRequest<"resolveLabel"> & { name: string })
  | (BaseRequest<"m4Expand"> & { source: string })
  | (BaseRequest<"lint"> & { source: string })
  | BaseRequest<"clearConsole">
  | BaseRequest<"codeBase">
  | BaseRequest<"lineMap">
  | BaseRequest<"memoryMap">;

export interface OkResponse<T> {
  id: number;
  kind: "ok";
  value: T;
}

export interface ErrorResponse {
  id: number;
  kind: "error";
  message: string;
}

/**
 * Heartbeat: unsolicited message from the worker carrying a fresh
 * snapshot. Sent every ~50ms during runUntilBreak so panels can
 * refresh while the run loop is still executing.
 */
export interface Heartbeat {
  id: -1;
  kind: "heartbeat";
  snapshot: StateSnapshot;
}

export type Response<T = unknown> = OkResponse<T> | ErrorResponse;

export type WorkerMessage = Response | Heartbeat;

export interface AssembleResultPayload {
  success: boolean;
  error?: string;
  error_line?: number;
  instruction_count: number;
}

export interface StepResultPayload {
  pc: number;
  halted: boolean;
  error: string | null;
  /**
   * Editor line of the instruction a runtime error names, resolved by the
   * wasm side through the line map (call site via LR-4 for faults inside host
   * stubs). Absent on success and on wasm builds that predate the field.
   */
  error_line?: number | null;
  outcome: string;
  exitCode: number | null;
}

export interface RunResultPayload {
  pc: number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error: string | null;
  /** Editor line for a runtime error (see StepResultPayload). */
  error_line?: number | null;
  /**
   * True when the run stopped only because it exhausted the caller's step
   * budget: not halted, not blocked, no breakpoint, no error. Without it a
   * budget stop is indistinguishable from a clean finish and an infinite loop
   * stops silently.
   */
  step_limit_reached?: boolean;
  /**
   * True when a reset/assemble/state-restore landed mid-run and this
   * result describes a machine that no longer exists. The hub discards
   * it: acting on it paints `unknown instruction: 0x00000000` right after the
   * student presses Reset.
   */
  cancelled?: boolean;
  /**
   * Milliseconds the program's last nanosleep asked to pause, when the
   * run stopped for one. The driver waits this out in real time and
   * resumes; absent on wasm builds that predate pacing.
   */
  sleep_ms?: number | null;
}

/**
 * The library call the pc is inside. A call like `bl printf` spends three
 * steps in code the student never wrote, so the wasm side names the callee
 * and its call site (from LR-4). Null on the program's own instructions and
 * absent on older wasm builds.
 */
export interface ExternalCall {
  /** The libc function being called ("printf", "scanf", ...). */
  name: string;
  /** Address of the `bl` that made the call. */
  callSitePc: number;
  /** Editor line of the call site, or null when the map cannot name one. */
  callSiteLine: number | null;
}

/**
 * All the state the UI needs after an operation, sent with every
 * state-changing reply and every heartbeat. `frame` only ever grows; the
 * memory cache keys on it so reads from an earlier frame are dropped.
 */
export interface StateSnapshot {
  frame: number;
  registers: string[];
  /** d0-d31 as "0x…" IEEE-754 bit patterns; [] when the WASM predates FP. */
  fpRegisters: string[];
  /** v0-v31 as "0x" + 32 hex digits (the same 128 bits q0-q31 name); [] when
   *  the WASM predates the vector surface, which hides the v-view. */
  vectorRegisters: string[];
  sp: string;
  pc: string;
  nzcv: number;
  changedRegs: number[];
  changedFpRegs: number[];
  halted: boolean;
  blocked: boolean;
  exitCode: number | null;
  canStepBack: boolean;
  stdoutDelta: string;
  stderrDelta: string;
  /**
   * Total bytes ever written to stdout, echoed input included. Step back and a
   * restore roll it back, which is how the console removes what an undone step
   * printed. Undefined on older wasm builds, which hides the feature.
   */
  stdoutSeen?: number;
  /** The same counter for stderr (see `stdoutSeen`). */
  stderrSeen?: number;
  vfsFiles: string[];
  savedStates: string[];
  /**
   * True once the running program has switched the terminal to raw
   * mode (ioctl TCSETS clearing ICANON/ECHO): the UI hands it the
   * terminal pane and routes keystrokes to stdin raw. False on wasm
   * builds that predate the flag.
   */
  wantsTerminal: boolean;
  /**
   * The external call the pc sits inside, or null when it is one of the
   * program's own instructions. Undefined on wasm builds that predate
   * `hostCallContext`, which is how the UI hides the feature.
   */
  externalCall?: ExternalCall | null;
  /**
   * Caller-saved registers the program read after a library call overwrote
   * them, since the previous snapshot: four numbers per note, worded by
   * lib/emulator/clobber-note. Undefined on wasm builds that predate them.
   */
  clobberNotes?: number[];
  /**
   * `(addr, len)` pairs of memory ranges written since the previous
   * snapshot. Drives memory-cell diff highlighting in the replay scrubber.
   * Flat array of `[addr, len, addr, len, ...]`.
   */
  dirtyAddrs: number[];
}

/**
 * The snapshot before any program is loaded: registers zeroed, sp at the
 * stack top, pc at the code base. Both backends return it before the first
 * assemble, so the register panel starts full and the two paths agree.
 */
export function emptyStateSnapshot(frame = 0): StateSnapshot {
  return {
    frame,
    registers: Array(31).fill("0x0000000000000000"),
    fpRegisters: [],
    vectorRegisters: [],
    // sp and pc mirror the Rust memory map's stack top and code base.
    sp: "0x0000000080000000",
    pc: "0x0000000000400000",
    nzcv: 0,
    changedRegs: [],
    changedFpRegs: [],
    halted: false,
    blocked: false,
    exitCode: null,
    canStepBack: false,
    stdoutDelta: "",
    stderrDelta: "",
    vfsFiles: [],
    savedStates: [],
    wantsTerminal: false,
    externalCall: null,
    dirtyAddrs: [],
  };
}
