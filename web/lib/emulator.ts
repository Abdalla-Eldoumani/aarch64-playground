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
  outcome: StepOutcome;
  exitCode: number | null;
}

export interface RunResult {
  pc: number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error: string | null;
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

  clearConsole(): void {
    this.inner.clear_console();
  }

  runUntilBreak(maxSteps: number): RunResult {
    const raw = this.inner.run_until_break(maxSteps) as RawRunResult;
    return {
      pc: Number(raw.pc),
      halted: raw.halted,
      steps_executed: raw.steps_executed,
      hit_breakpoint: raw.hit_breakpoint,
      error: raw.error ?? null,
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

  getChangedRegisters(): Uint8Array {
    return this.inner.get_changed_registers();
  }

  setBreakpoint(address: number): void {
    this.inner.set_breakpoint(address);
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
}

// raw types from wasm-bindgen (BigInt fields)
interface RawStepResult {
  pc: bigint | number;
  halted: boolean;
  error?: string;
  outcome?: StepOutcome;
  exit_code?: bigint | number | null;
}

interface RawRunResult {
  pc: bigint | number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error?: string;
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
  set_breakpoint(address: number): void;
  clear_breakpoint(address: number): void;
  is_halted(): boolean;
  code_base(): number;
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
  clear_console(): void;
}

type WasmEmulatorClass = new () => WasmEmulatorInstance;

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
