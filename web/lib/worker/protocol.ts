/**
 * Worker request/response protocol for the WASM emulator.
 *
 * Every call from the main thread to the worker is a `Request` carrying
 * an `id`. The worker replies with a `Response` echoing the same id, so
 * the client can match awaiters. The protocol mirrors the
 * `EmulatorInstance` surface in `lib/emulator.ts`; the client adapter
 * turns it into a Promise-returning facade.
 *
 * Phase 2 ships the scaffolding plus the most-used methods (init,
 * assemble, step, runUntilBreak, reset, takeStdout). Memory reads and
 * the lazy-fetch optimization stay on the main thread for now and land
 * in a follow-up pass.
 */

export type RequestKind =
  | "init"
  | "assemble"
  | "step"
  | "runUntilBreak"
  | "reset"
  | "takeStdout"
  | "pushStdin";

export interface InitRequest {
  id: number;
  kind: "init";
}

export interface AssembleRequest {
  id: number;
  kind: "assemble";
  source: string;
  args: string[];
}

export interface StepRequest {
  id: number;
  kind: "step";
}

export interface RunUntilBreakRequest {
  id: number;
  kind: "runUntilBreak";
  maxSteps: number;
}

export interface ResetRequest {
  id: number;
  kind: "reset";
}

export interface TakeStdoutRequest {
  id: number;
  kind: "takeStdout";
}

export interface PushStdinRequest {
  id: number;
  kind: "pushStdin";
  text: string;
}

export type Request =
  | InitRequest
  | AssembleRequest
  | StepRequest
  | RunUntilBreakRequest
  | ResetRequest
  | TakeStdoutRequest
  | PushStdinRequest;

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

export type Response<T = unknown> = OkResponse<T> | ErrorResponse;

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
