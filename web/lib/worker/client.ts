"use client";

import type {
  AssembleResultPayload,
  Request,
  RunResultPayload,
  StateSnapshot,
  StepResultPayload,
  WorkerMessage,
} from "@/lib/worker/protocol";

type SnapshotListener = (snap: StateSnapshot) => void;

/**
 * Promise-returning proxy over the emulator worker. Callers get back
 * an async surface mirroring the in-process EmulatorInstance, plus an
 * `onSnapshot` subscription that fires for every state change
 * (response snapshot or run-loop heartbeat).
 */
export class WorkerClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private listeners = new Set<SnapshotListener>();
  private initialized = false;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener("message", (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.kind === "heartbeat") {
        this.notify(msg.snapshot);
        return;
      }
      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);
      if (msg.kind === "ok") {
        // If the value carries a snapshot, fire the listener too so the
        // caller can update React state without unwrapping every method.
        if (typeof msg.value === "object" && msg.value !== null && "snapshot" in (msg.value as object)) {
          const snap = (msg.value as { snapshot: StateSnapshot }).snapshot;
          this.notify(snap);
        } else if (looksLikeSnapshot(msg.value)) {
          this.notify(msg.value as StateSnapshot);
        }
        slot.resolve(msg.value);
      } else {
        slot.reject(new Error(msg.message));
      }
    });
    this.worker.addEventListener("error", (e: ErrorEvent) => {
      for (const slot of this.pending.values()) {
        slot.reject(new Error(e.message || "worker error"));
      }
      this.pending.clear();
    });
  }

  onSnapshot(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async init(): Promise<StateSnapshot> {
    if (this.initialized) {
      return this.send<StateSnapshot>({ id: 0, kind: "init" });
    }
    const snap = await this.send<StateSnapshot>({ id: 0, kind: "init" });
    this.initialized = true;
    return snap;
  }

  assemble(
    source: string,
    args: string[] = [],
  ): Promise<{ result: AssembleResultPayload; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "assemble", source, args });
  }

  step(): Promise<{ stepResult: StepResultPayload; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "step" });
  }

  stepBack(): Promise<{ stepResult: StepResultPayload; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "stepBack" });
  }

  runUntilBreak(
    maxSteps: number,
  ): Promise<{ runResult: RunResultPayload; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "runUntilBreak", maxSteps });
  }

  pause(): Promise<void> {
    return this.send<null>({ id: 0, kind: "pause" }).then(() => undefined);
  }

  reset(): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "reset" });
  }

  pushStdin(text: string): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "pushStdin", text });
  }

  closeStdin(): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "closeStdin" });
  }

  clearAllBreakpoints(): Promise<void> {
    return this.send<void>({ id: 0, kind: "clearAllBreakpoints" });
  }

  isRangeMapped(addr: number, len: number): Promise<boolean> {
    return this.send<boolean>({ id: 0, kind: "isRangeMapped", addr, len });
  }

  takeStdout(): Promise<string> {
    return this.send<string>({ id: 0, kind: "takeStdout" });
  }

  takeStderr(): Promise<string> {
    return this.send<string>({ id: 0, kind: "takeStderr" });
  }

  getMemory(addr: number, len: number): Promise<Uint8Array> {
    return this.send<Uint8Array>({ id: 0, kind: "getMemory", addr, len });
  }

  getSnapshot(): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "getSnapshot" });
  }

  setBreakpoint(addr: number): Promise<void> {
    return this.send<null>({ id: 0, kind: "setBreakpoint", addr }).then(() => undefined);
  }

  clearBreakpoint(addr: number): Promise<void> {
    return this.send<null>({ id: 0, kind: "clearBreakpoint", addr }).then(() => undefined);
  }

  saveState(name: string): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "saveState", name });
  }

  loadState(name: string): Promise<{ ok: boolean; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "loadState", name });
  }

  deleteState(name: string): Promise<{ ok: boolean; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "deleteState", name });
  }

  listStates(): Promise<string[]> {
    return this.send<string[]>({ id: 0, kind: "listStates" });
  }

  uploadVfsFile(path: string, data: Uint8Array): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "uploadVfsFile", path, data });
  }

  listVfsFiles(): Promise<string[]> {
    return this.send<string[]>({ id: 0, kind: "listVfsFiles" });
  }

  readVfsFile(path: string): Promise<Uint8Array> {
    return this.send<Uint8Array>({ id: 0, kind: "readVfsFile", path });
  }

  deleteVfsFile(path: string): Promise<{ removed: boolean; snapshot: StateSnapshot }> {
    return this.send({ id: 0, kind: "deleteVfsFile", path });
  }

  resolveLabel(name: string): Promise<number | null> {
    return this.send<number | null>({ id: 0, kind: "resolveLabel", name });
  }

  m4Expand(
    source: string,
  ): Promise<{ success: boolean; text?: string; error?: string; error_line?: number } | null> {
    return this.send({ id: 0, kind: "m4Expand", source });
  }

  clearConsole(): Promise<StateSnapshot> {
    return this.send<StateSnapshot>({ id: 0, kind: "clearConsole" });
  }

  codeBase(): Promise<number> {
    return this.send<number>({ id: 0, kind: "codeBase" });
  }

  lineMap(): Promise<number[]> {
    return this.send<number[]>({ id: 0, kind: "lineMap" });
  }

  terminate(): void {
    this.worker.terminate();
    for (const slot of this.pending.values()) {
      slot.reject(new Error("worker terminated"));
    }
    this.pending.clear();
    this.listeners.clear();
  }

  private notify(snap: StateSnapshot): void {
    for (const listener of this.listeners) listener(snap);
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

function looksLikeSnapshot(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    "frame" in (v as object) &&
    "registers" in (v as object) &&
    "halted" in (v as object)
  );
}

/**
 * Spawn the emulator worker. Returns `null` when `Worker` isn't
 * available; the caller should fall back to the in-process backend.
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
