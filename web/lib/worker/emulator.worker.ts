/// <reference lib="webworker" />
/**
 * Worker entry. Owns the WASM Emulator and serves messages from the
 * main thread. After every state-mutating operation it sends back a
 * fresh `StateSnapshot` so the main-thread store can update React
 * state in one shot. During long `runUntilBreak` calls it emits
 * heartbeat snapshots every ~50ms so panels keep refreshing without
 * the run loop blocking the UI thread.
 */

import init, { Emulator, memoryMap } from "@/lib/wasm/aarch64_emulator";
import { normalizeMemoryMap, type MemoryRegion } from "@/lib/emulator/memory-map";
import { runChunked } from "@/lib/emulator/run-loop";
import { isDeadInstance } from "@/lib/worker/dead-instance";
import {
  emptyStateSnapshot,
  type AssembleResultPayload,
  type ExternalCall,
  type Heartbeat,
  type Request,
  type Response,
  type StateSnapshot,
  type StepResultPayload,
} from "@/lib/worker/protocol";

// Every heartbeat is a postMessage, so they are paced: one per chunk would
// flood the very thread the pacing exists to keep responsive. Only the
// snapshot fan-out rides this pace; pause and epoch are read every chunk.
const HEARTBEAT_INTERVAL_MS = 50;

let emulator: Emulator | null = null;
let regions: MemoryRegion[] | null = null;
let frame = 0;
let pauseRequested = false;
// Bumped by every operation that replaces the machine (reset, assemble,
// loadState, stepBack). A run loop that wakes into a different epoch is
// driving a machine that no longer exists and must stand down.
let runEpoch = 0;
let wasmReady: Promise<void> | null = null;

// Defer the WASM fetch + Emulator construction until the first
// state-mutating message. Keeps the initial page payload small: the
// worker boots with just the JS wrapper, and the ~200 KB compiled
// WASM blob only downloads when a student actually clicks `assemble`
// (or imports a program through any other path that mutates state).
function ensureWasm(): Promise<void> {
  if (wasmReady) return wasmReady;
  const p = init()
    .then(() => {
      emulator = new Emulator();
    })
    .catch((e: unknown) => {
      // A transient fetch/compile failure must not brick the worker: a
      // cached rejected promise would fail every future assemble until a
      // page reload. Clear it so the next mutating message retries.
      wasmReady = null;
      throw e;
    });
  wasmReady = p;
  return p;
}

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", async (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    switch (msg.kind) {
      case "init": {
        // Respond with the empty snapshot immediately; defer the WASM
        // fetch to the first state-mutating message.
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "assemble": {
        runEpoch++;
        await ensureWasm();
        const emu = require_emulator();
        const result =
          msg.args.length > 0
            ? (emu.assemble_and_load_with_args(msg.source, msg.args) as AssembleResultPayload)
            : (emu.assemble_and_load(msg.source) as AssembleResultPayload);
        bumpFrame();
        post({
          id: msg.id,
          kind: "ok",
          value: { result, snapshot: snapshot() },
        });
        return;
      }
      case "step": {
        await ensureWasm();
        const emu = require_emulator();
        const raw = emu.step() as Record<string, unknown>;
        bumpFrame();
        const stepResult: StepResultPayload = {
          pc: Number(raw.pc as bigint | number),
          halted: Boolean(raw.halted),
          error: (raw.error as string | undefined) ?? null,
          error_line: (raw.error_line as number | undefined) ?? null,
          outcome: (raw.outcome as string | undefined) ?? "advance",
          exitCode: raw.exit_code != null ? Number(raw.exit_code as bigint | number) : null,
        };
        post({
          id: msg.id,
          kind: "ok",
          value: { stepResult, snapshot: snapshot() },
        });
        return;
      }
      case "stepBack": {
        runEpoch++;
        await ensureWasm();
        const emu = require_emulator();
        const raw = emu.step_back() as Record<string, unknown>;
        bumpFrame();
        const stepResult: StepResultPayload = {
          pc: Number(raw.pc as bigint | number),
          halted: Boolean(raw.halted),
          error: (raw.error as string | undefined) ?? null,
          outcome: (raw.outcome as string | undefined) ?? "advance",
          exitCode: raw.exit_code != null ? Number(raw.exit_code as bigint | number) : null,
        };
        post({
          id: msg.id,
          kind: "ok",
          value: { stepResult, snapshot: snapshot() },
        });
        return;
      }
      case "runUntilBreak": {
        await ensureWasm();
        const emu = require_emulator();
        pauseRequested = false;
        const runResult = await runChunked(
          {
            runChunk: (steps) => {
              // wasm-bindgen hands back a plain record with bigint fields;
              // the protocol carries numbers.
              const raw = emu.run_until_break(steps) as Record<string, unknown>;
              return {
                pc: Number(raw.pc as bigint | number),
                halted: Boolean(raw.halted),
                steps_executed: Number(raw.steps_executed as number),
                hit_breakpoint: Boolean(raw.hit_breakpoint),
                error: (raw.error as string | undefined) ?? null,
                error_line: (raw.error_line as number | undefined) ?? null,
                sleep_ms: (raw.sleep_ms as number | undefined) ?? null,
              };
            },
            isBlocked: () => emu.is_blocked(),
            isPauseRequested: () => pauseRequested,
            currentEpoch: () => runEpoch,
            onChunk: bumpFrame,
            onHeartbeat: postHeartbeat,
          },
          msg.maxSteps,
          { heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS },
        );
        post({
          id: msg.id,
          kind: "ok",
          value: { runResult, snapshot: snapshot() },
        });
        return;
      }
      case "pause": {
        pauseRequested = true;
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "reset": {
        runEpoch++;
        await ensureWasm();
        const emu = require_emulator();
        emu.reset();
        bumpFrame();
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "pushStdin": {
        await ensureWasm();
        const emu = require_emulator();
        // A line the student typed at a prompt is echoed by the machine at
        // consume time, so the transcript reads like a cooked-mode terminal.
        // A redirect never echoes, and neither does an older wasm build --
        // it falls back to the silent queue instead of crashing the worker.
        const interactive = (emu as { push_stdin_interactive?: (s: string) => void })
          .push_stdin_interactive;
        if (msg.interactive && typeof interactive === "function") {
          interactive.call(emu, msg.text);
        } else {
          emu.push_stdin(msg.text);
        }
        bumpFrame();
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "lint": {
        await ensureWasm();
        const emu = require_emulator();
        // Feature-detect: an older local wasm build simply has no lint.
        const probe = (emu as { lint_source?: (s: string) => unknown }).lint_source;
        const warnings = typeof probe === "function" ? probe.call(emu, msg.source) : [];
        post({ id: msg.id, kind: "ok", value: warnings });
        return;
      }
      case "isRangeMapped": {
        await ensureWasm();
        const emu = require_emulator();
        // Feature-detect: an older local wasm build reports everything
        // mapped, degrading to the previous zero-fill behavior.
        const probe = (emu as { is_range_mapped?: (a: number, l: number) => boolean })
          .is_range_mapped;
        const mapped = typeof probe === "function" ? probe.call(emu, msg.addr, msg.len) : true;
        post({ id: msg.id, kind: "ok", value: mapped });
        return;
      }
      case "clearAllBreakpoints": {
        await ensureWasm();
        const emu = require_emulator();
        // Feature-detect for an older local wasm build.
        const clear = (emu as { clear_all_breakpoints?: () => void }).clear_all_breakpoints;
        if (typeof clear === "function") clear.call(emu);
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "closeStdin": {
        await ensureWasm();
        const emu = require_emulator();
        // Feature-detect: an older local wasm build has no close_stdin,
        // so end-of-input quietly stays unavailable instead of crashing.
        const close = (emu as { close_stdin?: () => void }).close_stdin;
        if (typeof close === "function") close.call(emu);
        bumpFrame();
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "setSnapshotsPaused": {
        await ensureWasm();
        const emu = require_emulator();
        // Feature-detect: an older local wasm build keeps snapshotting.
        const set = (emu as { set_snapshots_paused?: (p: boolean) => void })
          .set_snapshots_paused;
        if (typeof set === "function") set.call(emu, msg.paused);
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "takeStdout": {
        await ensureWasm();
        const emu = require_emulator();
        post({ id: msg.id, kind: "ok", value: emu.take_stdout() });
        return;
      }
      case "takeStderr": {
        await ensureWasm();
        const emu = require_emulator();
        post({ id: msg.id, kind: "ok", value: emu.take_stderr() });
        return;
      }
      case "getMemory": {
        await ensureWasm();
        const emu = require_emulator();
        const bytes = emu.get_memory_range(msg.addr, msg.len) as Uint8Array;
        // Copy into a fresh buffer so we can transfer ownership without
        // disturbing the WASM memory.
        const copy = new Uint8Array(bytes);
        post({ id: msg.id, kind: "ok", value: copy }, [copy.buffer]);
        return;
      }
      case "getSnapshot": {
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "setBreakpoint": {
        await ensureWasm();
        const emu = require_emulator();
        emu.set_breakpoint(msg.addr);
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "clearBreakpoint": {
        await ensureWasm();
        const emu = require_emulator();
        emu.clear_breakpoint(msg.addr);
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "saveState": {
        await ensureWasm();
        const emu = require_emulator();
        emu.save_state(msg.name);
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "loadState": {
        runEpoch++;
        await ensureWasm();
        const emu = require_emulator();
        const ok = emu.load_state(msg.name);
        bumpFrame();
        post({ id: msg.id, kind: "ok", value: { ok, snapshot: snapshot() } });
        return;
      }
      case "deleteState": {
        await ensureWasm();
        const emu = require_emulator();
        const ok = emu.delete_state(msg.name);
        post({ id: msg.id, kind: "ok", value: { ok, snapshot: snapshot() } });
        return;
      }
      case "listStates": {
        await ensureWasm();
        const emu = require_emulator();
        post({ id: msg.id, kind: "ok", value: emu.list_states() });
        return;
      }
      case "uploadVfsFile": {
        await ensureWasm();
        const emu = require_emulator();
        emu.upload_vfs_file(msg.path, msg.data);
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "listVfsFiles": {
        await ensureWasm();
        const emu = require_emulator();
        post({ id: msg.id, kind: "ok", value: emu.list_vfs_files() });
        return;
      }
      case "readVfsFile": {
        await ensureWasm();
        const emu = require_emulator();
        const bytes = emu.read_vfs_file(msg.path) as Uint8Array;
        // Copy and transfer the buffer like getMemory does so the
        // wasm-side allocation isn't pinned across postMessage.
        const copy = new Uint8Array(bytes);
        post({ id: msg.id, kind: "ok", value: copy }, [copy.buffer]);
        return;
      }
      case "deleteVfsFile": {
        await ensureWasm();
        const emu = require_emulator();
        const removed = emu.delete_vfs_file(msg.path);
        bumpFrame();
        post({ id: msg.id, kind: "ok", value: { removed, snapshot: snapshot() } });
        return;
      }
      case "m4Expand": {
        await ensureWasm();
        const emu = require_emulator();
        // Optional export: an older cached WASM answers null so the terminal
        // can explain instead of crashing the worker.
        const emulatorM4 = emu as unknown as { m4_expand?: (s: string) => unknown };
        const value = emulatorM4.m4_expand ? emulatorM4.m4_expand(msg.source) : null;
        post({ id: msg.id, kind: "ok", value });
        return;
      }
      case "resolveLabel": {
        await ensureWasm();
        const emu = require_emulator();
        const addr = emu.resolve_label(msg.name);
        // wasm-bindgen returns Option<u64> as bigint | undefined; flatten to
        // number | null for the JS protocol.
        const value =
          addr == null ? null : typeof addr === "bigint" ? Number(addr) : Number(addr);
        post({ id: msg.id, kind: "ok", value });
        return;
      }
      case "clearConsole": {
        await ensureWasm();
        const emu = require_emulator();
        emu.clear_console();
        post({ id: msg.id, kind: "ok", value: snapshot() });
        return;
      }
      case "codeBase": {
        await ensureWasm();
        const emu = require_emulator();
        post({ id: msg.id, kind: "ok", value: Number(emu.code_base()) });
        return;
      }
      case "lineMap": {
        await ensureWasm();
        const emu = require_emulator();
        // Flat `[addr, line, addr, line, ...]` editor-line map from the
        // most recent hosted assemble; empty for bare-metal programs.
        post({ id: msg.id, kind: "ok", value: Array.from(emu.get_line_map()) });
        return;
      }
      case "memoryMap": {
        await ensureWasm();
        post({ id: msg.id, kind: "ok", value: readMemoryMap() });
        return;
      }
      default: {
        const _exhaustive: never = msg;
        post({
          id: (msg as Request).id,
          kind: "error",
          message: `unknown request kind: ${JSON.stringify(_exhaustive)}`,
        });
      }
    }
  } catch (e) {
    if (isDeadInstance(e)) {
      // The instance cannot be used again: a wasm trap skips
      // wasm-bindgen's borrow-guard Drop, so the guard stays latched and
      // every later call throws on it. Dropping both makes the next
      // mutating message build a fresh machine instead of wedging the
      // playground until the student reloads the page.
      emulator = null;
      wasmReady = null;
    }
    post({
      id: msg.id,
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
});

function require_emulator(): Emulator {
  if (!emulator) {
    throw new Error("emulator not initialized; send `init` first");
  }
  return emulator;
}

function bumpFrame(): void {
  frame++;
}

/**
 * The emulator's address bands, read once from the module-level export and
 * kept: the layout is fixed for the life of the module. Feature-detected
 * like every optional surface -- an older local wasm build has no map, and
 * the memory panel then falls back to its own section list.
 */
function readMemoryMap(): MemoryRegion[] {
  if (regions) return regions;
  const probe = memoryMap as (() => unknown) | undefined;
  regions = typeof probe === "function" ? normalizeMemoryMap(probe()) : [];
  return regions;
}

function snapshot(): StateSnapshot {
  if (!emulator) {
    // WASM is instantiated lazily on the first mutating message, so `init`
    // and any pre-assemble snapshot run with no emulator. Return the shared
    // reset snapshot (a full 31-register file, not an empty array) so the
    // cold register panel shows every register instead of collapsing to
    // SP/PC, matching the main-thread backend.
    return emptyStateSnapshot(frame);
  }
  const regs = emulator.get_all_registers() as {
    gpr: string[];
    sp: string;
    pc: string;
    nzcv: number;
  };
  const changed = emulator.get_changed_registers() as Uint8Array;
  // Optional FP surface: present once the emulator crate ships it; the
  // worker keeps working against an older cached WASM by sending [].
  const emulatorFp = emulator as unknown as {
    get_fp_registers?: () => string[];
    get_changed_fp_registers?: () => Uint8Array;
  };
  const fpRegisters = emulatorFp.get_fp_registers?.() ?? [];
  const changedFp = emulatorFp.get_changed_fp_registers?.() ?? new Uint8Array(0);
  // Optional terminal-mode surface, feature-detected the same way.
  const emulatorTerm = emulator as unknown as { wants_terminal?: () => boolean };
  const wantsTerminal = emulatorTerm.wants_terminal?.() ?? false;
  // The external call the pc sits inside, read on every snapshot (the
  // wasm side only reads state). Optional export: an older cached WASM
  // reports null and the stepping surfaces stay exactly as they were.
  const externalCall = readExternalCall(emulator);
  // Drain stdout/stderr so React can append the delta as new bytes
  // arrive (versus polling the full buffer each frame).
  const stdoutDelta = emulator.take_stdout();
  const stderrDelta = emulator.take_stderr();
  // Optional display counters, feature-detected like every other surface:
  // absent on an older cached WASM, and the web then keeps its scrollback
  // append-only exactly as before.
  const emulatorSeen = emulator as unknown as {
    stdout_seen?: () => number;
    stderr_seen?: () => number;
  };
  const stdoutSeen = emulatorSeen.stdout_seen?.();
  const stderrSeen = emulatorSeen.stderr_seen?.();
  const exit = emulator.get_exit_code();
  return {
    frame,
    registers: regs.gpr,
    fpRegisters,
    sp: regs.sp,
    pc: regs.pc,
    nzcv: regs.nzcv,
    changedRegs: Array.from(changed),
    changedFpRegs: Array.from(changedFp),
    halted: emulator.is_halted(),
    blocked: emulator.is_blocked(),
    exitCode: exit == null ? null : Number(exit),
    canStepBack: emulator.can_step_back(),
    stdoutDelta,
    stderrDelta,
    ...(stdoutSeen != null ? { stdoutSeen } : {}),
    ...(stderrSeen != null ? { stderrSeen } : {}),
    vfsFiles: emulator.list_vfs_files(),
    savedStates: emulator.list_states(),
    wantsTerminal,
    externalCall,
    // Drain the dirty addresses. They accumulate between snapshot
    // calls, so failing to drain would make them grow unbounded.
    dirtyAddrs: Array.from(emulator.take_dirty_addrs()).map(Number),
  };
}

/**
 * The current pc's external-call context, normalized from the wasm side's
 * snake_case payload (the StepResult convention) to the protocol's camelCase.
 */
function readExternalCall(emu: Emulator): ExternalCall | null {
  const probe = (emu as unknown as { hostCallContext?: () => unknown }).hostCallContext;
  if (typeof probe !== "function") return null;
  const raw = probe.call(emu) as
    | { name: string; call_site_pc: bigint | number; call_site_line?: number | null }
    | null
    | undefined;
  if (!raw) return null;
  return {
    name: raw.name,
    callSitePc: Number(raw.call_site_pc),
    callSiteLine: raw.call_site_line ?? null,
  };
}

function post<T>(response: Response<T>, transfer: Transferable[] = []): void {
  ctx.postMessage(response, transfer);
}

function postHeartbeat(): void {
  const heartbeat: Heartbeat = {
    id: -1,
    kind: "heartbeat",
    snapshot: snapshot(),
  };
  ctx.postMessage(heartbeat);
}
