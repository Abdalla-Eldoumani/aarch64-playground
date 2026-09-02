/**
 * Worker request/response protocol for the WASM emulator.
 *
 * Every call from the main thread to the worker is a `Request` carrying
 * an `id`. The worker replies with a `Response` echoing the same id, so
 * the client can match awaiters. During long-running operations (the
 * run loop) the worker also emits unsolicited `Heartbeat` messages with
 * id = -1 carrying a fresh `StateSnapshot` so panels update mid-run.
 *
 * The protocol mirrors the EmulatorInstance surface but everything
 * is async; the in-process fallback wraps sync calls in Promise.resolve
 * to expose the same shape.
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
 * The external call a paused program counter sits inside. A hosted call
 * (`bl printf`) costs three steps on addresses the student never wrote (two
 * trampoline words and the synthetic stub), so the wasm side names the callee
 * and recovers the call site from LR-4 for all three. Null whenever the pc is
 * an instruction the program itself holds, and absent on wasm builds that
 * predate the export.
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
 * Snapshot of all state the UI needs after an operation. Sent in the
 * `ok` response of every state-mutating call (assemble/step/run/reset/
 * stepBack/loadState) and as the `snapshot` field of heartbeats.
 *
 * The `frame` field is a monotonically increasing counter the cache
 * layer uses as part of its cache key so memory reads from earlier
 * frames are invalidated when the worker advances.
 */
export interface StateSnapshot {
  frame: number;
  registers: string[];
  /** d0-d31 as "0x…" IEEE-754 bit patterns; [] when the WASM predates FP. */
  fpRegisters: string[];
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
   * Bytes the machine has ever written to stdout, echoed input included: an
   * absolute count the console scrollback aligns to. Step back and a named
   * restore roll it back to the frame's value, which is how the web unprints
   * what an undone step wrote. Undefined on wasm builds that predate the
   * counters, which hides the feature.
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
   * `(addr, len)` pairs of memory ranges written since the previous
   * snapshot. Drives memory-cell diff highlighting in the replay scrubber.
   * Flat array of `[addr, len, addr, len, ...]`.
   */
  dirtyAddrs: number[];
}

/**
 * The reset-state snapshot for a machine with no program loaded: all 31
 * general-purpose registers zeroed, the stack pointer at the top of the
 * mapped region, and the program counter at the code base where the first
 * instruction will land. Both backends return this before the first
 * assemble, so the cold register panel shows the full register file (not
 * just SP/PC) and the worker and main-thread paths agree byte for byte.
 */
export function emptyStateSnapshot(frame = 0): StateSnapshot {
  return {
    frame,
    registers: Array(31).fill("0x0000000000000000"),
    fpRegisters: [],
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
