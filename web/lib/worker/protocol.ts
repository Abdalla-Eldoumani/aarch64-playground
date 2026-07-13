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
  | "takeStdout"
  | "takeStderr"
  | "getMemory"
  | "getSnapshot"
  | "setBreakpoint"
  | "clearBreakpoint"
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
  | "clearConsole"
  | "codeBase"
  | "lineMap";

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
  | (BaseRequest<"pushStdin"> & { text: string })
  | BaseRequest<"takeStdout">
  | BaseRequest<"takeStderr">
  | (BaseRequest<"getMemory"> & { addr: number; len: number })
  | BaseRequest<"getSnapshot">
  | (BaseRequest<"setBreakpoint"> & { addr: number })
  | (BaseRequest<"clearBreakpoint"> & { addr: number })
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
  | BaseRequest<"clearConsole">
  | BaseRequest<"codeBase">
  | BaseRequest<"lineMap">;

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
  outcome: string;
  exitCode: number | null;
}

export interface RunResultPayload {
  pc: number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error: string | null;
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
  vfsFiles: string[];
  savedStates: string[];
  /// True if any memory page was written this frame; the cache uses this
  /// to invalidate panel ranges that might be stale.
  changedMem: boolean;
  /// `(addr, len)` pairs of memory ranges written since the previous
  /// snapshot. Drives memory-cell diff highlighting in the replay
  /// scrubber. Flat array of `[addr, len, addr, len, ...]`.
  dirtyAddrs: number[];
}

/**
 * The reset-state snapshot for a machine with no program loaded: all 31
 * general-purpose registers zeroed, the stack pointer at the top of the
 * mapped region, and the program counter at the code base where the first
 * instruction will land. Both backends return this before the first
 * assemble, so the cold register panel shows the full register file (not
 * just SP/PC) and the worker and main-thread paths agree byte for byte.
 * A single source of truth here keeps the two from drifting apart.
 */
export function emptyStateSnapshot(frame = 0): StateSnapshot {
  return {
    frame,
    registers: Array(31).fill("0x0000000000000000"),
    fpRegisters: [],
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
    changedMem: false,
    dirtyAddrs: [],
  };
}
