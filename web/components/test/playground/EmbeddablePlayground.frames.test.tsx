// A Run to a bad return, in the playground with its stack tab on the frames
// and in a lesson frame with its stack side shown, on the shipped hub and the
// real node build: the run row's alert carries the card once, and the frames
// view, which draws the same card, leaves it to the alert, so its polite
// status says nothing. Steps and lines are those of
// lib/test/emulator/frame-cards.test.ts's array-overrun.
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

const OVERRUN = readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures/array-overrun.s"), "utf8").replace(
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

/** After the Run: main's ret on line 21 takes the lr helper's stores
 *  overwrote, and the fetch at 0x700000006 faults. The card as the frames
 *  view draws it, in the alert once; the view's status empty. */
async function saidOnceByTheAlert() {
  const alert = await screen.findByRole("alert", {}, { timeout: 5000 });
  const frames = screen.getByRole("group", { name: "stack frames" });
  const card = await waitFor(() => {
    const items = within(within(frames).getByRole("list", { name: "what went wrong" })).getAllByRole("listitem");
    const ret = items.map((li) => li.textContent ?? "").find((text) => text.startsWith("main's ret on line 21 "));
    expect(ret).toBeDefined();
    return ret!;
  });
  expect(card).toMatch(/ jumped to 0x700000006 instead of going back to the C runtime, because /);
  expect(alert.textContent!.replaceAll("`", "").split(card).length - 1).toBe(1);
  // Let any status the stop set render.
  await act(() => new Promise((done) => setTimeout(done, 0)));
  expect(within(frames).getByRole("status").textContent).toBe("");
}

describe("a Run's bad return, said once", () => {
  it("in the playground, by the run row's alert and not by the stack tab's frames", async () => {
    setWidth(800);
    render(<EmbeddablePlayground chrome="full" startSource={OVERRUN} />);
    fireEvent.click(await screen.findByRole("tab", { name: "stack" }, { timeout: 5000 }));
    await screen.findByRole("group", { name: "stack frames" });
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    await saidOnceByTheAlert();
  });

  it("in a lesson frame, by the run row's alert and not by the stack side's frames", async () => {
    render(<EmbeddablePlayground chrome="embed" startSource={OVERRUN} />);
    fireEvent.click(within(screen.getByRole("group", { name: "registers or stack" })).getByRole("button", { name: "stack" }));
    // A press on the cold frame's run wakes the machine and runs once it loads.
    fireEvent.mouseDown(screen.getByRole("button", { name: "run" }));
    await saidOnceByTheAlert();
  });
});
