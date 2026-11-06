// The call card through the real surfaces, on the shipped hub and the real
// node build: the locals example steps through its scanf with stdin 7 4 (the
// lesson frame's seed, the playground's console box) in a lesson frame and in
// the playground, and the console shows what scanf stored and where, said
// once. Steps are counted by hand from locals.s: the prologue (2), ldr and bl
// printf (2), the trampoline (2) and printf (1), ldr and two adds (3), bl
// scanf (1), the trampoline (2) and scanf (1): 14.
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

const LOCALS = readFileSync(path.join(process.cwd(), "public/examples/cpsc355/locals.s"), "utf8").replace(
  /\r\n/g,
  "\n",
);

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

// The surfaces and the card arrive through dynamic imports, and a first
// transform inside a test can outlast its one-second wait.
beforeAll(async () => {
  await import("@/components/playground/FullChromeSurface");
  await import("@/components/panels/CallCard");
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

async function stepTo(count: number): Promise<void> {
  for (let n = 0; n < count; n++) {
    const before = pc;
    // Found again each time: the cold frame's button gives way to the live one.
    fireEvent.click(await screen.findByLabelText("step", {}, { timeout: 5000 }));
    await waitFor(() => expect(pc).not.toBe(before), { timeout: 5000 });
    // The state reaches the host before the step's own promise settles; a
    // press in between is a press during a step.
    await act(() => new Promise((done) => setTimeout(done, 0)));
  }
}

// The pc each state change reports, so a step is known to have landed (the
// frame's step counter is hidden in its compact controls).
let pc = -1;
const track = (state: { pc: number }) => {
  pc = state.pc;
};

/** After scanf: the card in the console once, its rows as worked out from
 *  locals.s, and its sentence in the console's polite status. */
async function scanfCardShown(): Promise<void> {
  const card = await screen.findByRole("group", { name: "what scanf did" }, { timeout: 5000 });
  expect(within(card).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "%d stored 7 at a_s (fp + 16), the address in x1",
    "%d stored 4 at b_s (fp + 20), the address in x2",
  ]);
  expect(card.textContent).toContain('scanf("%d %d")');
  expect(card.textContent).toContain("line 36");
  const said = screen.getAllByRole("status").filter((s) => s.textContent?.startsWith('scanf("%d %d")'));
  expect(said).toHaveLength(1);
}

describe("the call card in the console", () => {
  beforeEach(() => {
    pc = -1;
  });

  // Fourteen presses, each a step through the real hub: longer than the
  // default five seconds on a loaded machine.
  it("in a lesson frame, after stepping through locals.s's scanf", async () => {
    render(<EmbeddablePlayground chrome="embed" startSource={LOCALS} startStdin={"7 4\n"} onStateChange={track} />);
    await stepTo(14);
    await scanfCardShown();
    // The next step runs no call, and the card goes with it.
    await stepTo(1);
    await waitFor(() => expect(screen.queryByRole("group", { name: "what scanf did" })).toBeNull());
  }, 30_000);

  it("in the playground's console tab, after stepping through locals.s's scanf", async () => {
    setWidth(800);
    render(<EmbeddablePlayground chrome="full" startSource={LOCALS} onStateChange={track} />);
    fireEvent.click(await screen.findByRole("tab", { name: "console" }, { timeout: 5000 }));
    // The playground steps only what was assembled.
    fireEvent.click((await screen.findAllByLabelText("assemble", {}, { timeout: 5000 }))[0]);
    await waitFor(() => expect(screen.getByLabelText("step")).toHaveProperty("disabled", false), { timeout: 5000 });
    // To scanf's stub, where the input is typed as a student types it, and
    // the next step reads it.
    await stepTo(13);
    const input = screen.getByLabelText("Standard input");
    fireEvent.change(input, { target: { value: "7 4" } });
    fireEvent.submit(input.closest("form")!);
    await stepTo(1);
    await scanfCardShown();
  }, 30_000);
});
