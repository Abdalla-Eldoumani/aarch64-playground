import { createRequire } from "node:module";
import path from "node:path";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { useEmulator } from "@/lib/emulator/use-emulator";
import { emptyStateSnapshot, type Request } from "@/lib/worker/protocol";

// Each mount of the hub owns one emulator worker: unmounting releases it,
// and a remount starts a fresh one. Only the platform's Worker is faked; the
// hub, the backend picker and the worker client are the shipped ones.

// The boot's three requests get real answers; every other request gets the
// null a void worker case posts.
const REPLIES: Partial<Record<Request["kind"], unknown>> = {
  init: emptyStateSnapshot(0),
  codeBase: 0x400000,
  memoryMap: [],
};

const spawned: FakeWorker[] = [];

class FakeWorker {
  terminated = 0;
  private listeners: Array<(e: { data: unknown }) => void> = [];

  constructor() {
    spawned.push(this);
  }

  addEventListener(type: string, fn: (e: { data: unknown }) => void) {
    if (type === "message") this.listeners.push(fn);
  }

  // Answers a task later, as a real worker does; a terminated worker
  // answers nothing.
  postMessage(msg: Request) {
    setTimeout(() => {
      if (this.terminated) return;
      const reply = { id: msg.id, kind: "ok", value: REPLIES[msg.kind] ?? null };
      for (const fn of this.listeners) fn({ data: reply });
    }, 0);
  }

  terminate() {
    this.terminated++;
  }
}

// The main-thread backend's machine is a node build: the web build of the
// wasm cannot load under node.
const nodeRequire = createRequire(import.meta.url);
const wasm = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import(
  "@/lib/wasm-node/aarch64_emulator"
);
const machines: InstanceType<typeof wasm.Emulator>[] = [];

vi.mock("@/lib/emulator/emulator", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/emulator/emulator")>();
  return {
    ...real,
    loadEmulator: async () => {
      const emu = new wasm.Emulator();
      machines.push(emu);
      return new real.EmulatorInstance(emu);
    },
    detectHostedMode: async (source: string) => wasm.detectHostedMode(source),
    loadMemoryMap: async () => normalizeMemoryMap(wasm.memoryMap()),
  };
});

const unhandled: unknown[] = [];
const recordUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  vi.stubGlobal("Worker", FakeWorker);
  process.on("unhandledRejection", recordUnhandled);
});

afterEach(() => {
  cleanup();
  process.off("unhandledRejection", recordUnhandled);
  vi.unstubAllGlobals();
  spawned.length = 0;
  unhandled.length = 0;
  window.localStorage.removeItem("aarch64-playground:backend");
  for (const emu of machines.splice(0)) emu.free();
});

async function mountBooted() {
  const view = renderHook(() => useEmulator());
  await waitFor(() => expect(view.result.current.isLoaded).toBe(true));
  return view;
}

describe("useEmulator worker lifecycle", () => {
  it("terminates its worker once on unmount, and a remount spawns a new one", async () => {
    const first = await mountBooted();
    expect(spawned).toHaveLength(1);
    first.unmount();
    expect(spawned[0].terminated).toBe(1);

    const second = await mountBooted();
    expect(spawned).toHaveLength(2);
    expect(spawned.map((w) => w.terminated)).toEqual([1, 0]);
    second.unmount();
    expect(spawned.map((w) => w.terminated)).toEqual([1, 1]);
  });

  it("a request still in flight at unmount raises no unhandled rejection", async () => {
    const view = await mountBooted();
    // Fire and forget, as the console and the terminal pane send stdin.
    act(() => view.result.current.pushStdin("42\n"));
    view.unmount();
    await new Promise((settle) => setTimeout(settle, 20));
    expect(unhandled).toEqual([]);
    expect(spawned[0].terminated).toBe(1);
  });
});

// A program paced by nanosleep, 50 ms a pass, forever.
const PACED = `
        .data
pause:  .dword 0
        .dword 50000000

        .text
        .balign 4
        .global main
main:
tick:
        ldr     x0, =pause
        mov     x1, 0
        mov     x8, 101
        svc     0
        b       tick
`;

describe("useEmulator main-thread lifecycle", () => {
  it("stops a run paced by sleeps when it unmounts during a sleep", async () => {
    // With no worker to terminate, only the hub can stop its run drive:
    // otherwise the program runs on after the student leaves the playground.
    window.localStorage.setItem("aarch64-playground:backend", "main");
    const view = await mountBooted();
    expect(spawned).toHaveLength(0);
    await act(async () => {
      expect(await view.result.current.assemble(PACED)).toBe(true);
    });
    const runs = vi.spyOn(machines[0], "run_until_break");
    act(() => {
      void view.result.current.run();
    });
    await waitFor(() => expect(runs).toHaveBeenCalled());
    // Inside the drive's 50 ms wait for the sleep.
    await new Promise((settle) => setTimeout(settle, 10));
    const before = runs.mock.calls.length;
    view.unmount();
    await new Promise((settle) => setTimeout(settle, 300));
    expect(runs.mock.calls.length).toBe(before);
  });
});
