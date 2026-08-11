import { normalizeMemoryMap, type MemoryRegion } from "@/lib/emulator/memory-map";
import type { ExternalCall } from "@/lib/worker/protocol";

export interface AssembleResult {
  success: boolean;
  error: string | null;
  error_line: number | null;
  instruction_count: number;
}

export type StepOutcome =
  | "advance"
  | "halted"
  | "waiting"
  | "exited"
  | "error";

export interface StepResult {
  pc: number;
  halted: boolean;
  error: string | null;
  /**
   * Editor line the runtime error resolves to through the authoritative
   * line map (LR-4 recovers the call site for host-stub faults). Null on
   * success and on wasm builds that predate the field.
   */
  error_line: number | null;
  outcome: StepOutcome;
  exitCode: number | null;
}

export interface RunResult {
  pc: number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error: string | null;
  /** Editor line for a runtime error (see StepResult). */
  error_line: number | null;
  /** Pause the last nanosleep asked for, in ms; null when the run
   *  stopped for any other reason (or the wasm predates pacing). */
  sleep_ms: number | null;
}

export interface RegisterState {
  gpr: string[];
  sp: string;
  pc: string;
  nzcv: number;
}

/**
 * Typed wrapper around the WASM emulator module.
 * Handles dynamic import and BigInt-to-string conversion.
 */
export class EmulatorInstance {
  private inner: WasmEmulatorInstance;

  constructor(inner: WasmEmulatorInstance) {
    this.inner = inner;
  }

  assembleAndLoad(source: string): AssembleResult {
    return this.inner.assemble_and_load(source) as AssembleResult;
  }

  assembleAndLoadWithArgs(source: string, args: string[]): AssembleResult {
    return this.inner.assemble_and_load_with_args(source, args) as AssembleResult;
  }

  step(): StepResult {
    const raw = this.inner.step() as RawStepResult;
    return {
      pc: Number(raw.pc),
      halted: raw.halted,
      error: raw.error ?? null,
      error_line: raw.error_line ?? null,
      outcome: raw.outcome ?? "advance",
      exitCode: raw.exit_code != null ? Number(raw.exit_code) : null,
    };
  }

  stepBack(): StepResult {
    const raw = this.inner.step_back() as RawStepResult;
    return {
      pc: Number(raw.pc),
      halted: raw.halted,
      error: raw.error ?? null,
      error_line: raw.error_line ?? null,
      outcome: raw.outcome ?? "advance",
      exitCode: raw.exit_code != null ? Number(raw.exit_code) : null,
    };
  }

  canStepBack(): boolean {
    return this.inner.can_step_back();
  }

  saveState(name: string): void {
    this.inner.save_state(name);
  }

  loadState(name: string): boolean {
    return this.inner.load_state(name);
  }

  deleteState(name: string): boolean {
    return this.inner.delete_state(name);
  }

  listStates(): string[] {
    return this.inner.list_states();
  }

  takeStdout(): string {
    return this.inner.take_stdout();
  }

  takeStderr(): string {
    return this.inner.take_stderr();
  }

  /** Signal end-of-input. A pre-close wasm build lacks the export, so
   *  the call quietly does nothing there (feature detection). */
  closeStdin(): void {
    const close = (this.inner as { close_stdin?: () => void }).close_stdin;
    if (typeof close === "function") close.call(this.inner);
  }

  /** Pause/resume the step-back snapshot ring for live terminal
   *  sessions. Feature-detected so an older wasm build just keeps
   *  snapshotting. */
  setSnapshotsPaused(paused: boolean): void {
    const set = (this.inner as { set_snapshots_paused?: (p: boolean) => void })
      .set_snapshots_paused;
    if (typeof set === "function") set.call(this.inner, paused);
  }

  pushStdin(s: string): void {
    this.inner.push_stdin(s);
  }

  isBlocked(): boolean {
    return this.inner.is_blocked();
  }

  getExitCode(): number | null {
    const code = this.inner.get_exit_code();
    return code == null ? null : Number(code);
  }

  uploadVfsFile(path: string, data: Uint8Array): void {
    this.inner.upload_vfs_file(path, data);
  }

  listVfsFiles(): string[] {
    return this.inner.list_vfs_files();
  }

  readVfsFile(path: string): Uint8Array {
    return this.inner.read_vfs_file(path);
  }

  deleteVfsFile(path: string): boolean {
    return this.inner.delete_vfs_file(path);
  }

  resolveLabel(name: string): number | null {
    const v = this.inner.resolve_label(name);
    if (v == null) return null;
    return typeof v === "bigint" ? Number(v) : Number(v);
  }

  takeDirtyAddrs(): number[] {
    return Array.from(this.inner.take_dirty_addrs());
  }

  clearConsole(): void {
    this.inner.clear_console();
  }

  /** True once the program switched the terminal to raw mode; false on
   *  wasm builds that predate the flag. */
  wantsTerminal(): boolean {
    const inner = this.inner as unknown as { wants_terminal?: () => boolean };
    return inner.wants_terminal?.() ?? false;
  }

  /** The external call the current pc sits inside, or null when the pc is
   *  one of the program's own instructions -- and null on wasm builds that
   *  predate the export, which hides the feature. The wasm side answers in
   *  snake_case (the StepResult convention), normalized here. */
  hostCallContext(): ExternalCall | null {
    const probe = (this.inner as { hostCallContext?: () => unknown }).hostCallContext;
    if (typeof probe !== "function") return null;
    const raw = probe.call(this.inner) as RawHostCallContext | null | undefined;
    if (!raw) return null;
    return {
      name: raw.name,
      callSitePc: Number(raw.call_site_pc),
      callSiteLine: raw.call_site_line ?? null,
    };
  }

  runUntilBreak(maxSteps: number): RunResult {
    const raw = this.inner.run_until_break(maxSteps) as RawRunResult;
    return {
      pc: Number(raw.pc),
      halted: raw.halted,
      steps_executed: raw.steps_executed,
      hit_breakpoint: raw.hit_breakpoint,
      error: raw.error ?? null,
      error_line: raw.error_line ?? null,
      sleep_ms: raw.sleep_ms ?? null,
    };
  }

  reset(): void {
    this.inner.reset();
  }

  getPc(): number {
    return Number(this.inner.get_pc());
  }

  getRegister(index: number): string {
    const val = this.inner.get_register(index);
    return "0x" + BigInt(val).toString(16).padStart(16, "0");
  }

  getSp(): string {
    const val = this.inner.get_sp();
    return "0x" + BigInt(val).toString(16).padStart(16, "0");
  }

  getNzcv(): number {
    return this.inner.get_nzcv();
  }

  getAllRegisters(): RegisterState {
    return this.inner.get_all_registers() as RegisterState;
  }

  getMemoryRange(addr: number, len: number): Uint8Array {
    return this.inner.get_memory_range(addr, len);
  }

  /** Whether every page in the range is mapped; true on a wasm build
   *  that predates the export (degrades to the zero-fill behavior). */
  isRangeMapped(addr: number, len: number): boolean {
    const probe = (this.inner as { is_range_mapped?: (a: number, l: number) => boolean })
      .is_range_mapped;
    return typeof probe === "function" ? probe.call(this.inner, addr, len) : true;
  }

  getChangedRegisters(): Uint8Array {
    return this.inner.get_changed_registers();
  }

  /** The 32 FP registers (d0-d31) as "0x…" bit patterns, or [] when the
   *  loaded WASM predates the FP surface (feature-detected, never throws). */
  getFpRegisters(): string[] {
    return this.inner.get_fp_registers?.() ?? [];
  }

  /** Indices of d-registers the last step wrote; [] on an older WASM. */
  getChangedFpRegisters(): Uint8Array {
    return this.inner.get_changed_fp_registers?.() ?? new Uint8Array(0);
  }

  /** Pre-assembly structural lint warnings; [] on a wasm build that
   *  predates the export (feature-detected, never throws). */
  lintSource(source: string): Array<{ line: number; message: string }> {
    const probe = (this.inner as { lint_source?: (s: string) => unknown }).lint_source;
    if (typeof probe !== "function") return [];
    return probe.call(this.inner, source) as Array<{ line: number; message: string }>;
  }

  /** Run the m4 pass alone (the terminal's `m4` command). Null when the
   *  loaded WASM predates the export (feature-detected, never throws). */
  m4Expand(source: string): { success: boolean; text?: string; error?: string; error_line?: number } | null {
    const result = this.inner.m4_expand?.(source);
    return (result ?? null) as
      | { success: boolean; text?: string; error?: string; error_line?: number }
      | null;
  }

  setBreakpoint(address: number): void {
    this.inner.set_breakpoint(address);
  }

  /** Remove every breakpoint; a no-op on a wasm build that predates the
   *  export (feature detection). */
  clearAllBreakpoints(): void {
    const clear = (this.inner as { clear_all_breakpoints?: () => void }).clear_all_breakpoints;
    if (typeof clear === "function") clear.call(this.inner);
  }

  clearBreakpoint(address: number): void {
    this.inner.clear_breakpoint(address);
  }

  isHalted(): boolean {
    return this.inner.is_halted();
  }

  codeBase(): number {
    return this.inner.code_base();
  }

  /** Flat `[addr, line, addr, line, ...]` authoritative address ->
   *  editor-source-line map from the most recent hosted assemble. Empty
   *  for the legacy bare-metal path. */
  getLineMap(): number[] {
    return Array.from(this.inner.get_line_map());
  }
}

// raw types from wasm-bindgen (BigInt fields, snake_case keys)
interface RawHostCallContext {
  name: string;
  call_site_pc: bigint | number;
  call_site_line?: number | null;
}

interface RawStepResult {
  pc: bigint | number;
  halted: boolean;
  error?: string;
  error_line?: number | null;
  outcome?: StepOutcome;
  exit_code?: bigint | number | null;
}

interface RawRunResult {
  pc: bigint | number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error?: string;
  error_line?: number | null;
  sleep_ms?: number | null;
}

// the WASM module's Emulator instance shape
interface WasmEmulatorInstance {
  assemble_and_load(source: string): unknown;
  assemble_and_load_with_args(source: string, args: string[]): unknown;
  step(): unknown;
  step_back(): unknown;
  can_step_back(): boolean;
  save_state(name: string): void;
  load_state(name: string): boolean;
  delete_state(name: string): boolean;
  list_states(): string[];
  run_until_break(max_steps: number): unknown;
  reset(): void;
  get_pc(): bigint;
  get_register(index: number): bigint;
  get_sp(): bigint;
  get_nzcv(): number;
  get_all_registers(): unknown;
  get_memory_range(addr: number, len: number): Uint8Array;
  get_changed_registers(): Uint8Array;
  /** Optional: present once the emulator crate ships the FP surface. */
  get_fp_registers?(): string[];
  get_changed_fp_registers?(): Uint8Array;
  /** Optional: standalone m4 pass, present once the crate ships it. */
  m4_expand?(source: string): unknown;
  /** Optional: external-call context for the current pc (js_name is
   *  camelCase on this one; its payload keys are not). */
  hostCallContext?(): unknown;
  set_breakpoint(address: number): void;
  clear_breakpoint(address: number): void;
  is_halted(): boolean;
  code_base(): number;
  get_line_map(): Uint32Array;
  take_stdout(): string;
  take_stderr(): string;
  push_stdin(s: string): void;
  is_blocked(): boolean;
  get_exit_code(): bigint | number | null | undefined;
  upload_vfs_file(path: string, data: Uint8Array): void;
  list_vfs_files(): string[];
  read_vfs_file(path: string): Uint8Array;
  delete_vfs_file(path: string): boolean;
  resolve_label(name: string): bigint | number | null | undefined;
  take_dirty_addrs(): Uint32Array;
  clear_console(): void;
}

type WasmModule = typeof import("@/lib/wasm/aarch64_emulator");

let wasmModulePromise: Promise<WasmModule> | null = null;

async function ensureWasmModule(): Promise<WasmModule> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      const wasm = await import("@/lib/wasm/aarch64_emulator");
      await wasm.default();
      return wasm;
    })();
  }
  return wasmModulePromise;
}

/**
 * Load the WASM module and return an EmulatorInstance.
 * This is async because of the dynamic import.
 */
export async function loadEmulator(): Promise<EmulatorInstance> {
  const wasm = await ensureWasmModule();
  const inner = new wasm.Emulator();
  return new EmulatorInstance(inner);
}

/**
 * Hosted-mode detection routed through the Rust source of truth. The
 * TS side used to maintain a parallel regex list which drifted from the
 * Rust list; this helper makes the WASM module the only place that
 * decides. First call awaits the WASM load; subsequent calls use the
 * cached module so latency is just the wasm-bindgen marshalling.
 */
export async function detectHostedMode(source: string): Promise<boolean> {
  const wasm = await ensureWasmModule();
  return wasm.detectHostedMode(source);
}

/**
 * The emulator's address bands, read from the module-level `memoryMap`
 * export (mirroring `detectHostedMode`: fixed for the life of the module,
 * so the caller reads it once and keeps it). Returns [] on a wasm build
 * that predates the export, which is the memory panel's cue to fall back to
 * its own section list instead of labelling addresses it cannot verify.
 */
export async function loadMemoryMap(): Promise<MemoryRegion[]> {
  const wasm = await ensureWasmModule();
  const probe = (wasm as { memoryMap?: () => unknown }).memoryMap;
  if (typeof probe !== "function") return [];
  return normalizeMemoryMap(probe());
}
