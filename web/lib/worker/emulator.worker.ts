/// <reference lib="webworker" />
/**
 * Worker entry. Owns one WASM `Emulator` instance and serves messages
 * from the main thread. Keeps method dispatch flat and synchronous --
 * each request runs to completion before the next is read, so there's
 * no concurrency model to worry about inside the worker.
 *
 * Run loops (`runUntilBreak`) intentionally don't yield mid-run to the
 * worker's event queue: students get the same step-count semantics as
 * the main-thread fallback, just without the UI freeze. The follow-up
 * pass adds heartbeat messages so panels can update mid-run.
 */

import init, { Emulator } from "@/lib/wasm/aarch64_emulator";
import type {
  AssembleResultPayload,
  Request,
  Response,
  RunResultPayload,
  StepResultPayload,
} from "@/lib/worker/protocol";

let emulator: Emulator | null = null;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", async (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    switch (msg.kind) {
      case "init": {
        await init();
        emulator = new Emulator();
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "assemble": {
        const emu = require_emulator();
        const result =
          msg.args.length > 0
            ? (emu.assemble_and_load_with_args(msg.source, msg.args) as AssembleResultPayload)
            : (emu.assemble_and_load(msg.source) as AssembleResultPayload);
        post({ id: msg.id, kind: "ok", value: result });
        return;
      }
      case "step": {
        const emu = require_emulator();
        const raw = emu.step() as Record<string, unknown>;
        const value: StepResultPayload = {
          pc: Number(raw.pc as bigint | number),
          halted: Boolean(raw.halted),
          error: (raw.error as string | undefined) ?? null,
          outcome: (raw.outcome as string | undefined) ?? "advance",
          exitCode: raw.exit_code != null ? Number(raw.exit_code as bigint | number) : null,
        };
        post({ id: msg.id, kind: "ok", value });
        return;
      }
      case "runUntilBreak": {
        const emu = require_emulator();
        const raw = emu.run_until_break(msg.maxSteps) as Record<string, unknown>;
        const value: RunResultPayload = {
          pc: Number(raw.pc as bigint | number),
          halted: Boolean(raw.halted),
          steps_executed: Number(raw.steps_executed as number),
          hit_breakpoint: Boolean(raw.hit_breakpoint),
          error: (raw.error as string | undefined) ?? null,
        };
        post({ id: msg.id, kind: "ok", value });
        return;
      }
      case "reset": {
        const emu = require_emulator();
        emu.reset();
        post({ id: msg.id, kind: "ok", value: null });
        return;
      }
      case "takeStdout": {
        const emu = require_emulator();
        const text = emu.take_stdout();
        post({ id: msg.id, kind: "ok", value: text });
        return;
      }
      case "pushStdin": {
        const emu = require_emulator();
        emu.push_stdin(msg.text);
        post({ id: msg.id, kind: "ok", value: null });
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

function post<T>(response: Response<T>, transfer: Transferable[] = []): void {
  ctx.postMessage(response, transfer);
}
