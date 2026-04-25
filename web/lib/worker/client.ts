"use client";

import type {
  AssembleResultPayload,
  Request,
  Response,
  RunResultPayload,
  StepResultPayload,
} from "@/lib/worker/protocol";

/**
 * Promise-returning proxy over the emulator worker. Each call posts a
 * `Request` and awaits the matching `Response` (matched by `id`).
 * Falls back gracefully when `Worker` isn't available -- the caller
 * can detect this via `isWorkerBacked()` and use the main-thread
 * `EmulatorInstance` instead.
 *
 * Phase 2 wires the client up but the default in `useEmulator` stays
 * on the main-thread instance until the panel-side memory cache is in
 * place. To opt in for testing: set `localStorage.setItem(
 * "aarch64-playground:worker", "1")` and reload.
 */
export class WorkerClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private initialized = false;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", (e: MessageEvent<Response>) => {
      const msg = e.data;
      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);
      if (msg.kind === "ok") slot.resolve(msg.value);
      else slot.reject(new Error(msg.message));
    });
    this.worker.addEventListener("error", (e: ErrorEvent) => {
      // Reject every outstanding request so callers don't hang.
      for (const slot of this.pending.values()) {
        slot.reject(new Error(e.message || "worker error"));
      }
      this.pending.clear();
    });
  }

  isWorkerBacked(): true {
    return true;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.send<null>({ id: 0, kind: "init" });
    this.initialized = true;
  }

  assemble(source: string, args: string[] = []): Promise<AssembleResultPayload> {
    return this.send<AssembleResultPayload>({
      id: 0,
      kind: "assemble",
      source,
      args,
    });
  }

  step(): Promise<StepResultPayload> {
    return this.send<StepResultPayload>({ id: 0, kind: "step" });
  }

  runUntilBreak(maxSteps: number): Promise<RunResultPayload> {
    return this.send<RunResultPayload>({
      id: 0,
      kind: "runUntilBreak",
      maxSteps,
    });
  }

  reset(): Promise<void> {
    return this.send<null>({ id: 0, kind: "reset" }).then(() => undefined);
  }

  takeStdout(): Promise<string> {
    return this.send<string>({ id: 0, kind: "takeStdout" });
  }

  pushStdin(text: string): Promise<void> {
    return this.send<null>({ id: 0, kind: "pushStdin", text }).then(() => undefined);
  }

  terminate(): void {
    this.worker.terminate();
    for (const slot of this.pending.values()) {
      slot.reject(new Error("worker terminated"));
    }
    this.pending.clear();
  }

  private send<T>(msg: Request): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      this.worker.postMessage({ ...msg, id });
    });
  }
}

/**
 * Spawn the emulator worker. Returns `null` when `Worker` isn't
 * available (SSR, sandboxed iframes, ancient browsers); the caller
 * should fall back to `EmulatorInstance` in that case.
 */
export function spawnEmulatorWorker(): WorkerClient | null {
  if (typeof Worker === "undefined") return null;
  try {
    const worker = new Worker(
      new URL("./emulator.worker.ts", import.meta.url),
      { type: "module" },
    );
    return new WorkerClient(worker);
  } catch {
    return null;
  }
}

/**
 * Read the localStorage opt-in flag for the worker-backed path. Lets
 * power users (and developers) flip the implementation without code
 * changes; the default stays on the main-thread instance until the
 * panel-side memory cache is in place.
 */
export function isWorkerOptInEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("aarch64-playground:worker") === "1";
  } catch {
    return false;
  }
}
