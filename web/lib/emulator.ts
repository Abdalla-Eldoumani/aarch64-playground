export interface AssembleResult {
  success: boolean;
  error: string | null;
  error_line: number | null;
  instruction_count: number;
}

export interface StepResult {
  pc: number;
  halted: boolean;
  error: string | null;
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
  private inner: InstanceType<WasmEmulatorClass>;

  constructor(inner: InstanceType<WasmEmulatorClass>) {
    this.inner = inner;
  }

  assembleAndLoad(source: string): AssembleResult {
    return this.inner.assemble_and_load(source) as AssembleResult;
  }

  step(): StepResult {
    const raw = this.inner.step() as RawStepResult;
    return {
      pc: Number(raw.pc),
      halted: raw.halted,
      error: raw.error ?? null,
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
}

interface RawRunResult {
  pc: bigint | number;
  halted: boolean;
  steps_executed: number;
  hit_breakpoint: boolean;
  error?: string;
}

// the WASM module's Emulator class shape
interface WasmEmulatorClass {
  new (): InstanceType<WasmEmulatorClass>;
  assemble_and_load(source: string): unknown;
  step(): unknown;
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
}

/**
 * Load the WASM module and return an EmulatorInstance.
 * This is async because of the dynamic import.
 */
export async function loadEmulator(): Promise<EmulatorInstance> {
  const wasm = await import("@/lib/wasm/aarch64_emulator");
  await wasm.default();
  const inner = new wasm.Emulator();
  return new EmulatorInstance(inner);
}
