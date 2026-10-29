// The call card on the shipped hub and the real node build, inside the real
// console: drawn after the step that ran the call and gone the step after,
// hidden while a run goes, and said once per call per program load, through
// a remount and a Back onto it. Steps are counted by hand from locals.s with
// stdin 7 4: 7 steps finish the prompt's printf, 14 finish scanf, and 25
// finish the printf of the sum and product (lines 38 to 46 are 7 steps, then
// bl printf, its trampoline and printf).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallCard } from "@/components/panels/CallCard";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import type { EmulatorState } from "@/lib/emulator/emulator-state";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { useEmulator } from "@/lib/emulator/use-emulator";

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

beforeEach(() => {
  window.localStorage.setItem("aarch64-playground:backend", "main");
});

afterEach(() => {
  cleanup();
  for (const emu of machines.splice(0)) emu.free();
});

const LOCALS = readFileSync(path.join(process.cwd(), "public/examples/cpsc355/locals.s"), "utf8").replace(
  /\r\n/g,
  "\n",
);
const SCANF_SAID =
  'scanf("%d %d") on line 36 returned 2 in w0. ' +
  "%d stored 7 at a_s (fp + 16), the address in x1. %d stored 4 at b_s (fp + 20), the address in x2.";

/** The hub, and the console with the card while `shown`. */
function Console({ shown, onHub }: { shown: boolean; onHub: (hub: EmulatorState) => void }) {
  const emu = useEmulator();
  useEffect(() => onHub(emu));
  return (
    <ConsolePanel
      stdout={emu.stdout}
      stderr={emu.stderr}
      call={shown && <CallCard {...emu} />}
      blocked={emu.blocked}
      exitCode={emu.exitCode}
      vfsFiles={[]}
      pushStdin={emu.pushStdin}
      closeStdin={emu.closeStdin}
      uploadVfsFile={() => {}}
      clearConsole={emu.clearConsole}
    />
  );
}

async function mounted() {
  let hub: EmulatorState | null = null;
  const onHub = (h: EmulatorState) => {
    hub = h;
  };
  const view = render(<Console shown onHub={onHub} />);
  await waitFor(() => expect(hub?.isLoaded).toBe(true));
  // Every text the card's status takes, in order.
  const heard: string[] = [];
  let last = "";
  new MutationObserver(() => {
    const text = screen.queryAllByRole("status").map((s) => s.textContent ?? "").find((t) => t.trim()) ?? "";
    if (text !== last) {
      last = text;
      if (text.trim()) heard.push(text.trim());
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  const get = () => hub!;
  const load = async () => {
    await act(async () => {
      await expect(get().assemble(LOCALS)).resolves.toBe(true);
    });
    act(() => get().pushStdin("7 4\n"));
  };
  const stepTo = async (count: number) => {
    while (get().stepCount < count) {
      const next = get().stepCount + 1;
      act(() => get().step());
      await waitFor(() => expect(get().stepCount).toBe(next));
    }
  };
  return {
    hub: get,
    heard,
    load,
    stepTo,
    remount: () => {
      view.rerender(<Console shown={false} onHub={onHub} />);
      view.rerender(<Console shown onHub={onHub} />);
    },
  };
}

const card = () => screen.queryByRole("group", { name: /^what (printf|scanf) did$/ });
const settled = () => act(() => new Promise((done) => setTimeout(done, 0)));

describe("the call card on the hub", () => {
  it("shows after the step that ran the call, and is gone the step after", async () => {
    const m = await mounted();
    await m.load();
    await m.stepTo(13);
    expect(card()).toBeNull();
    await m.stepTo(14);
    expect(within(card()!).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "%d stored 7 at a_s (fp + 16), the address in x1",
      "%d stored 4 at b_s (fp + 20), the address in x2",
    ]);
    await m.stepTo(15);
    expect(card()).toBeNull();
  });

  it("says each call once per load: not again on a remount or a Back onto it", async () => {
    const m = await mounted();
    await m.load();
    await m.stepTo(7);
    await m.stepTo(14);
    await settled();
    expect(m.heard).toEqual(['printf("Enter two integers: ") on line 31 printed "Enter two integers: ".', SCANF_SAID]);
    m.remount();
    act(() => m.hub().stepBack());
    await waitFor(() => expect(m.hub().stepCount).toBe(13));
    await m.stepTo(14);
    await settled();
    expect(card()).not.toBeNull();
    expect(m.heard).toHaveLength(2);
    await m.stepTo(25);
    await settled();
    expect(m.heard.at(-1)).toBe(
      'printf("Sum = %d, Product = %d new line ") on line 47 printed "Sum = 11, Product = 28 new line ". ' +
        "%d printed 11, the value in w1. %d printed 28, the value in w2.",
    );
    // A new load is a new program: its calls are said again.
    await m.load();
    await m.stepTo(14);
    await settled();
    expect(m.heard.filter((text) => text === SCANF_SAID)).toHaveLength(2);
  });

  it("is hidden while a run goes", async () => {
    const m = await mounted();
    await m.load();
    await m.stepTo(14);
    expect(card()).not.toBeNull();
    // The hub's state as a run streams it: the same call, the run going.
    const state = m.hub();
    cleanup();
    render(<CallCard {...state} isRunning />);
    expect(card()).toBeNull();
  });
});
