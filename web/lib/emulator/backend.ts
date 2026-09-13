"use client";

import {
  loadEmulator,
  loadMemoryMap,
  type EmulatorInstance,
} from "@/lib/emulator/emulator";
import type { MemoryRegion } from "@/lib/emulator/memory-map";
import { runChunked } from "@/lib/emulator/run-loop";
import {
  emptyStateSnapshot,
  type AssembleResultPayload,
  type RunResultPayload,
  type StateSnapshot,
  type StepResultPayload,
} from "@/lib/worker/protocol";
import { spawnEmulatorWorker } from "@/lib/worker/client";
import { safeGetItem } from "@/lib/playground/safe-storage";

/**
 * Async surface every emulator backend exposes. WorkerBackend serves
 * this from a separate thread; MainThreadBackend wraps the in-process
 * EmulatorInstance with Promise.resolve so useEmulator can treat both
 * paths identically.
 */
export interface EmulatorBackend {
  init(): Promise<StateSnapshot>;
  assemble(
    source: string,
    args: string[],
  ): Promise<{ result: AssembleResultPayload; snapshot: StateSnapshot }>;
  step(): Promise<{ stepResult: StepResultPayload; snapshot: StateSnapshot }>;
  stepBack(): Promise<{ stepResult: StepResultPayload; snapshot: StateSnapshot }>;
  runUntilBreak(
    maxSteps: number,
  ): Promise<{ runResult: RunResultPayload; snapshot: StateSnapshot }>;
  pause(): Promise<void>;
  reset(): Promise<StateSnapshot>;
  /** Queue stdin. `interactive` is a line typed at a prompt: the machine
   *  echoes it into stdout as a read consumes it. A redirect leaves it off. */
  pushStdin(text: string, interactive?: boolean): Promise<StateSnapshot>;
  /** Signal end-of-input (ctrl-d / a fully-queued redirect). */
  closeStdin(): Promise<StateSnapshot>;
  /** Pause/resume the step-back snapshot ring (live terminal sessions:
   *  the per-step clone costs more than the step). */
  setSnapshotsPaused(paused: boolean): Promise<void>;
  getMemory(addr: number, len: number): Promise<Uint8Array>;
  /** Whether every page in the range is mapped (watch fault display). */
  isRangeMapped(addr: number, len: number): Promise<boolean>;
  /** Pre-assembly structural lint warnings (advisory, line + remedy). */
  lint(source: string): Promise<Array<{ line: number; message: string }>>;
  setBreakpoint(addr: number): Promise<void>;
  clearBreakpoint(addr: number): Promise<void>;
  /** Remove every breakpoint at once (program switch / re-assemble). */
  clearAllBreakpoints(): Promise<void>;
  saveState(name: string): Promise<StateSnapshot>;
  loadState(name: string): Promise<{ ok: boolean; snapshot: StateSnapshot }>;
  deleteState(name: string): Promise<{ ok: boolean; snapshot: StateSnapshot }>;
  uploadVfsFile(path: string, data: Uint8Array): Promise<StateSnapshot>;
  readVfsFile(path: string): Promise<Uint8Array>;
  deleteVfsFile(path: string): Promise<{ removed: boolean; snapshot: StateSnapshot }>;
  resolveLabel(name: string): Promise<number | null>;
  /** Standalone m4 pass; null when the WASM predates the export. */
  m4Expand(source: string): Promise<{ success: boolean; text?: string; error?: string; error_line?: number } | null>;
  clearConsole(): Promise<StateSnapshot>;
  codeBase(): Promise<number>;
  /** Flat `[addr, line, addr, line, ...]` editor-line map from the most
   *  recent assemble; empty for the bare-metal path. */
  lineMap(): Promise<number[]>;
  /** The emulator's address bands, read once from the wasm module; empty
   *  on a build that predates the export. */
  memoryMap(): Promise<MemoryRegion[]>;
  /** Subscribe to state-snapshot events: every response and every heartbeat. */
  onSnapshot(listener: (snap: StateSnapshot) => void): () => void;
}

/**
 * MainThreadBackend wraps EmulatorInstance to expose the same async
 * surface as WorkerBackend. State snapshots are constructed on the
 * main thread after each call. Used as a fallback when Worker is
 * unavailable (SSR, sandboxed iframes) and for tests.
 */
class MainThreadBackend implements EmulatorBackend {
  private emu: EmulatorInstance | null = null;
  private regions: MemoryRegion[] | null = null;
  private frame = 0;
  // Bumped by every machine-replacing operation; a run loop that wakes
  // into a different epoch stands down (see runUntilBreak).
  private runEpoch = 0;
  private pauseRequested = false;
  private listeners = new Set<(snap: StateSnapshot) => void>();

  async init(): Promise<StateSnapshot> {
    this.emu = await loadEmulator();
    return this.snapshot();
  }

  async assemble(
    source: string,
    args: string[],
  ): Promise<{ result: AssembleResultPayload; snapshot: StateSnapshot }> {
    this.runEpoch++;
    const emu = this.requireEmu();
    const raw = args.length > 0
      ? emu.assembleAndLoadWithArgs(source, args)
      : emu.assembleAndLoad(source);
    const result: AssembleResultPayload = {
      success: raw.success,
      error: raw.error ?? undefined,
      error_line: raw.error_line ?? undefined,
      instruction_count: raw.instruction_count,
    };
    this.frame++;
    return this.notifyAndReturn({ result, snapshot: this.snapshot() });
  }

  async step(): Promise<{ stepResult: StepResultPayload; snapshot: StateSnapshot }> {
    const emu = this.requireEmu();
    const raw = emu.step();
    const stepResult: StepResultPayload = {
      pc: raw.pc,
      halted: raw.halted,
      error: raw.error,
      error_line: raw.error_line,
      outcome: raw.outcome ?? "advance",
      exitCode: raw.exitCode,
    };
    this.frame++;
    return this.notifyAndReturn({ stepResult, snapshot: this.snapshot() });
  }

  async stepBack(): Promise<{ stepResult: StepResultPayload; snapshot: StateSnapshot }> {
    this.runEpoch++;
    const emu = this.requireEmu();
    const raw = emu.stepBack();
    const stepResult: StepResultPayload = {
      pc: raw.pc,
      halted: raw.halted,
      error: raw.error,
      error_line: raw.error_line,
      outcome: raw.outcome ?? "advance",
      exitCode: raw.exitCode,
    };
    this.frame++;
    return this.notifyAndReturn({ stepResult, snapshot: this.snapshot() });
  }

  async runUntilBreak(
    maxSteps: number,
  ): Promise<{ runResult: RunResultPayload; snapshot: StateSnapshot }> {
    const emu = this.requireEmu();
    this.pauseRequested = false;
    const runResult = await runChunked(
      {
        // The typed wrapper already coerced the wasm record.
        runChunk: (steps) => emu.runUntilBreak(steps),
        isBlocked: () => emu.isBlocked(),
        isPauseRequested: () => this.pauseRequested,
        currentEpoch: () => this.runEpoch,
        onChunk: () => {
          this.frame++;
        },
        // In process, a heartbeat is a direct listener call rather than a
        // postMessage, so it rides every chunk instead of a pace.
        onHeartbeat: () => this.notify(this.snapshot()),
      },
      maxSteps,
    );
    // Through notifyAndReturn like every other operation here: the hub
    // reads run state from snapshot events, and on the worker path the
    // client already fans the response snapshot out the same way.
    return this.notifyAndReturn({ runResult, snapshot: this.snapshot() });
  }

  async pause(): Promise<void> {
    // Observed by runUntilBreak at its between-chunk yield, mirroring the
    // worker's flag.
    this.pauseRequested = true;
  }

  async reset(): Promise<StateSnapshot> {
    this.runEpoch++;
    this.requireEmu().reset();
    this.frame++;
    return this.notifyAndReturn(this.snapshot());
  }

  async pushStdin(text: string, interactive = false): Promise<StateSnapshot> {
    this.requireEmu().pushStdin(text, interactive);
    this.frame++;
    return this.notifyAndReturn(this.snapshot());
  }

  async closeStdin(): Promise<StateSnapshot> {
    this.requireEmu().closeStdin();
    this.frame++;
    return this.notifyAndReturn(this.snapshot());
  }

  async setSnapshotsPaused(paused: boolean): Promise<void> {
    this.requireEmu().setSnapshotsPaused(paused);
  }

  async getMemory(addr: number, len: number): Promise<Uint8Array> {
    return this.requireEmu().getMemoryRange(addr, len);
  }

  async setBreakpoint(addr: number): Promise<void> {
    this.requireEmu().setBreakpoint(addr);
  }

  async clearBreakpoint(addr: number): Promise<void> {
    this.requireEmu().clearBreakpoint(addr);
  }

  async clearAllBreakpoints(): Promise<void> {
    this.requireEmu().clearAllBreakpoints();
  }

  async isRangeMapped(addr: number, len: number): Promise<boolean> {
    return this.requireEmu().isRangeMapped(addr, len);
  }

  async lint(source: string): Promise<Array<{ line: number; message: string }>> {
    return this.requireEmu().lintSource(source);
  }

  async saveState(name: string): Promise<StateSnapshot> {
    this.requireEmu().saveState(name);
    return this.notifyAndReturn(this.snapshot());
  }

  async loadState(name: string): Promise<{ ok: boolean; snapshot: StateSnapshot }> {
    this.runEpoch++;
    const ok = this.requireEmu().loadState(name);
    if (ok) this.frame++;
    return this.notifyAndReturn({ ok, snapshot: this.snapshot() });
  }

  async deleteState(name: string): Promise<{ ok: boolean; snapshot: StateSnapshot }> {
    const ok = Boolean(this.requireEmu().deleteState(name));
    return this.notifyAndReturn({ ok, snapshot: this.snapshot() });
  }

  async uploadVfsFile(path: string, data: Uint8Array): Promise<StateSnapshot> {
    this.requireEmu().uploadVfsFile(path, data);
    return this.notifyAndReturn(this.snapshot());
  }

  async readVfsFile(path: string): Promise<Uint8Array> {
    const bytes = this.requireEmu().readVfsFile(path);
    return bytes;
  }

  async deleteVfsFile(path: string): Promise<{ removed: boolean; snapshot: StateSnapshot }> {
    const removed = this.requireEmu().deleteVfsFile(path);
    if (removed) this.frame++;
    return this.notifyAndReturn({ removed, snapshot: this.snapshot() });
  }

  async resolveLabel(name: string): Promise<number | null> {
    return this.requireEmu().resolveLabel(name);
  }

  async m4Expand(source: string) {
    return this.requireEmu().m4Expand(source);
  }

  async clearConsole(): Promise<StateSnapshot> {
    this.requireEmu().clearConsole();
    return this.notifyAndReturn(this.snapshot());
  }

  async codeBase(): Promise<number> {
    return this.requireEmu().codeBase();
  }

  async lineMap(): Promise<number[]> {
    return this.requireEmu().getLineMap();
  }

  async memoryMap(): Promise<MemoryRegion[]> {
    // Read once and kept: the bands are fixed for the life of the module.
    if (!this.regions) this.regions = await loadMemoryMap();
    return this.regions;
  }

  onSnapshot(listener: (snap: StateSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private requireEmu(): EmulatorInstance {
    if (!this.emu) {
      throw new Error("emulator not initialized; call init() first");
    }
    return this.emu;
  }

  private snapshot(): StateSnapshot {
    if (!this.emu) {
      return emptyStateSnapshot(this.frame);
    }
    const regs = this.emu.getAllRegisters();
    // Feature-detected display counters: null on an older wasm build, and
    // the key then stays off the snapshot so the hub skips the unprint.
    const stdoutSeen = this.emu.stdoutSeen();
    const stderrSeen = this.emu.stderrSeen();
    return {
      frame: this.frame,
      registers: regs.gpr,
      fpRegisters: this.emu.getFpRegisters(),
      vectorRegisters: this.emu.getVectorRegisters(),
      sp: regs.sp,
      pc: regs.pc,
      nzcv: regs.nzcv,
      changedRegs: Array.from(this.emu.getChangedRegisters()),
      changedFpRegs: Array.from(this.emu.getChangedFpRegisters()),
      halted: this.emu.isHalted(),
      blocked: this.emu.isBlocked(),
      exitCode: this.emu.getExitCode(),
      canStepBack: this.emu.canStepBack(),
      stdoutDelta: this.emu.takeStdout(),
      stderrDelta: this.emu.takeStderr(),
      ...(stdoutSeen != null ? { stdoutSeen } : {}),
      ...(stderrSeen != null ? { stderrSeen } : {}),
      vfsFiles: this.emu.listVfsFiles(),
      savedStates: this.emu.listStates(),
      wantsTerminal: this.emu.wantsTerminal(),
      externalCall: this.emu.hostCallContext(),
      dirtyAddrs: this.emu.takeDirtyAddrs(),
    };
  }

  private notify(snap: StateSnapshot): void {
    for (const listener of this.listeners) listener(snap);
  }

  private notifyAndReturn<T>(payload: T): T {
    if (typeof payload === "object" && payload !== null) {
      const obj = payload as { snapshot?: StateSnapshot };
      if (obj.snapshot) this.notify(obj.snapshot);
      else if (looksLikeSnapshot(payload)) this.notify(payload as unknown as StateSnapshot);
    }
    return payload;
  }
}

function looksLikeSnapshot(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    "frame" in (v as object) &&
    "registers" in (v as object)
  );
}

/**
 * Pick a backend based on environment + opt-in flag. Honors the
 * `aarch64-playground:backend` localStorage key:
 * - `"main"` -> always main-thread (fallback)
 * - `"worker"` -> worker, throws if unavailable
 * - any other value (or absent) -> worker if available, else main-thread.
 */
export function pickBackend(): EmulatorBackend {
  const force = safeGetItem("aarch64-playground:backend");
  if (force === "main") {
    return new MainThreadBackend();
  }
  const worker = spawnEmulatorWorker();
  if (worker) return worker as unknown as EmulatorBackend;
  return new MainThreadBackend();
}
