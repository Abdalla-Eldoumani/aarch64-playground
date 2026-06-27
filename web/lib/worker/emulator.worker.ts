/// <reference lib="webworker" />
/**
 * Worker entry. Owns the WASM Emulator and serves messages from the
 * main thread. After every state-mutating operation it sends back a
 * fresh `StateSnapshot` so the main-thread store can update React
 * state in one shot. During long `runUntilBreak` calls it emits
 * heartbeat snapshots every ~50ms so panels keep refreshing without
 * the run loop blocking the UI thread.
 */

import init, { Emulator } from "@/lib/wasm/aarch64_emulator";
import type {
  AssembleResultPayload,
  Heartbeat,
  Request,
  Response,
  RunResultPayload,
  StateSnapshot,
  StepResultPayload,
} from "@/lib/worker/protocol";

let emulator: Emulator | null = null;
let frame = 0;
let pauseRequested = false;
let wasmReady: Promise<void> | null = null;

// Defer the WASM fetch + Emulator construction until the first
// state-mutating message. Keeps the initial page payload small: the
// worker boots with just the JS wrapper, and the ~200 KB compiled
// WASM blob only downloads when a student actually clicks `assemble`
// (or imports a program through any other path that mutates state).
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = init().then(() => {
      emulator = new Emulator();
    });
  }
  return wasmReady;
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
        // Drive the run loop in chunks of ~10k steps and yield to the
        // event queue between chunks so heartbeats actually fire and
        // pause requests are picked up.
        pauseRequested = false;
        const HEARTBEAT_STEPS = 10_000;
        let totalSteps = 0;
        let lastResult: RunResultPayload = {
          pc: 0,
          halted: false,
          steps_executed: 0,
          hit_breakpoint: false,
          error: null,
        };
        let lastHeartbeat = performance.now();
        while (totalSteps < msg.maxSteps) {
          if (pauseRequested) break;
          const remaining = Math.min(HEARTBEAT_STEPS, msg.maxSteps - totalSteps);
          const raw = emu.run_until_break(remaining) as Record<string, unknown>;
          const stepsThis = Number(raw.steps_executed as number);
          totalSteps += stepsThis;
          lastResult = {
            pc: Number(raw.pc as bigint | number),
            halted: Boolean(raw.halted),
            steps_executed: stepsThis,
            hit_breakpoint: Boolean(raw.hit_breakpoint),
            error: (raw.error as string | undefined) ?? null,
          };
          bumpFrame();
          if (lastResult.error || lastResult.halted || lastResult.hit_breakpoint) break;
          if (emu.is_blocked()) break;
          // Yield + heartbeat at most every ~50ms so panels stay
          // responsive without flooding postMessage.
          const now = performance.now();
          if (now - lastHeartbeat >= 50) {
            postHeartbeat();
            lastHeartbeat = now;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        }
        // Fold totalSteps into the result so the caller can update its
        // step counter accurately even though we ran in chunks.
        lastResult.steps_executed = totalSteps;
        post({
          id: msg.id,
          kind: "ok",
          value: { runResult: lastResult, snapshot: snapshot() },
        });
        return;
      }
      case "pause": {
        pauseRequested = true;
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "reset": {
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
        emu.push_stdin(msg.text);
        bumpFrame();
        post({ id: msg.id, kind: "ok", value: snapshot() });
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

function snapshot(): StateSnapshot {
  if (!emulator) {
    return {
      frame,
      registers: [],
      sp: "0x0000000000000000",
      pc: "0x0000000000000000",
      nzcv: 0,
      changedRegs: [],
      halted: false,
      blocked: false,
      exitCode: null,
      canStepBack: false,
      stdoutDelta: "",
      stderrDelta: "",
      vfsFiles: [],
      savedStates: [],
      changedMem: false,
      pcTrace: [],
      dirtyAddrs: [],
    };
  }
  const regs = emulator.get_all_registers() as {
    gpr: string[];
    sp: string;
    pc: string;
    nzcv: number;
  };
  const changed = emulator.get_changed_registers() as Uint8Array;
  // Drain stdout/stderr so React can append the delta as new bytes
  // arrive (versus polling the full buffer each frame).
  const stdoutDelta = emulator.take_stdout();
  const stderrDelta = emulator.take_stderr();
  const exit = emulator.get_exit_code();
  return {
    frame,
    registers: regs.gpr,
    sp: regs.sp,
    pc: regs.pc,
    nzcv: regs.nzcv,
    changedRegs: Array.from(changed),
    halted: emulator.is_halted(),
    blocked: emulator.is_blocked(),
    exitCode: exit == null ? null : Number(exit),
    canStepBack: emulator.can_step_back(),
    stdoutDelta,
    stderrDelta,
    vfsFiles: emulator.list_vfs_files(),
    savedStates: emulator.list_states(),
    // The Cpu doesn't currently expose a "wrote memory this step" flag;
    // bump on every state-mutating call instead, which keeps panel caches
    // honest at the cost of a re-fetch per step. The cache layer keys
    // its read by `frame` so the fetches still dedup within a frame.
    changedMem: true,
    // Drain the per-step PC trace and dirty addresses. Both are
    // additive between snapshot calls, so failing to drain would make
    // them grow unbounded.
    pcTrace: Array.from(emulator.take_pc_trace()).map((v) =>
      typeof v === "bigint" ? Number(v) : Number(v),
    ),
    dirtyAddrs: Array.from(emulator.take_dirty_addrs()).map(Number),
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
