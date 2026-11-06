// The list of calls on the shipped hub and the real node build: a Run, which
// never stops between steps, still lists every call it made, returned ones
// included, in the playground's stack tab; a lesson frame's stack side,
// too short to hold it beside the frames, draws the frames alone.
// call-tree.s's calls and values are worked out in
// lib/test/emulator/call-tree.test.ts.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";

const nodeRequire = createRequire(import.meta.url);
const wasm = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import(
  "@/lib/wasm-node/aarch64_emulator"
);
const machines: InstanceType<typeof wasm.Emulator>[] = [];

// The web build of the wasm cannot load under node, so the hub's machine is
// a node one.
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
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: () => <div data-testid="console" />,
}));
vi.mock("@/components/playground/ResizableLayout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/playground/ResizableLayout")>()),
  ResizableLayout: () => <div data-testid="layout" />,
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div data-testid="pane-split">
      {first}
      {second}
    </div>
  ),
}));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";

const CALLS = readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures/call-tree.s"), "utf8").replace(
  /\r\n/g,
  "\n",
);

// The tablet arrangement renders the right-hand tab strip directly.
function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

// The full surface and the frames view arrive through dynamic imports, and a
// first transform inside a test can outlast its one-second wait.
beforeAll(async () => {
  await import("@/components/playground/FullChromeSurface");
  await import("@/components/panels/FramesView");
});

beforeEach(() => {
  window.localStorage.setItem("aarch64-playground:backend", "main");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setWidth(1024);
  for (const emu of machines.splice(0)) emu.free();
});

/** Each row of the list as a reader hears it, in order. */
const heard = (list: HTMLElement) => within(list).getAllByRole("listitem").map((li) => li.querySelector("p")!.textContent);

describe("the list of calls", () => {
  it("lists every call a Run made in the playground's stack tab, each returned call with its value", async () => {
    setWidth(800);
    render(<EmbeddablePlayground chrome="full" startSource={CALLS} />);
    fireEvent.click(await screen.findByRole("tab", { name: "stack" }, { timeout: 5000 }));
    await screen.findByRole("group", { name: "stack frames" });
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    const list = await screen.findByRole("list", { name: "calls so far" }, { timeout: 5000 });
    await waitFor(() => expect(heard(list).at(-1)).toBe("cube × 33 calls of cube · all returned"), { timeout: 5000 });
    expect(heard(list)).toEqual([
      "mainmain · returned 0",
      "fact(4)fact(4) · returned 24",
      "fact(3)fact(3) · returned 6",
      "fact(2)fact(2) · returned 2",
      "fact(1)fact(1) · returned 1",
      "cube(1)cube(1) · returned 1",
      "cube(2)cube(2) · returned 8",
      "cube(3)cube(3) · returned 27",
      "cube(4)cube(4) · returned 64",
      "cube × 33 calls of cube · all returned",
    ]);
  }, 20_000);

  it("is left out of a lesson frame's stack side, which draws the frames alone", async () => {
    render(<EmbeddablePlayground chrome="embed" startSource={CALLS} />);
    fireEvent.click(within(screen.getByRole("group", { name: "registers or stack" })).getByRole("button", { name: "stack" }));
    // A press on the cold frame's step wakes the machine and steps once it loads.
    fireEvent.mouseDown(screen.getByRole("button", { name: "step" }));
    await screen.findByRole("list", { name: "calls, main first" }, { timeout: 5000 });
    await act(() => new Promise((done) => setTimeout(done, 0)));
    expect(screen.queryByRole("list", { name: "calls so far" })).toBeNull();
  });
});
