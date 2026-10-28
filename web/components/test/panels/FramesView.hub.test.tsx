// The frames view on the shipped hub, the main-thread backend and the real
// node build, wired as the playground wires it: what its polite status says
// when a run stops (at a breakpoint, a run to cursor, a step over, a step
// out), what it leaves to the run row's alert, and that only a new load of
// the program says a card again. Steps are counted in the fixtures' notes
// (lib/test/emulator/frame-cards.test.ts).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FramesView } from "@/components/panels/FramesView";
import type { EmulatorState, StepTarget } from "@/lib/emulator/emulator-state";
import { normalizeMemoryMap } from "@/lib/emulator/memory-map";
import { useEmulator } from "@/lib/emulator/use-emulator";

const nodeRequire = createRequire(import.meta.url);
const wasm = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import(
  "@/lib/wasm-node/aarch64_emulator"
);
type Machine = InstanceType<typeof wasm.Emulator>;
const machines: Machine[] = [];

// The web build of the wasm cannot load under node, so each hub's machine is
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

beforeEach(() => {
  window.localStorage.setItem("aarch64-playground:backend", "main");
});

afterEach(() => {
  cleanup();
  for (const emu of machines.splice(0)) emu.free();
});

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "lib/test/emulator/fixtures", name), "utf8").replace(/\r\n/g, "\n");
const OVERRUN = fixture("array-overrun.s");

/** The hub, and its frames view while `shown` (the stack tab is open). */
function Stack({ shown, onHub }: { shown: boolean; onHub: (hub: EmulatorState) => void }) {
  const emu = useEmulator();
  useEffect(() => onHub(emu));
  if (!shown) return null;
  return (
    <FramesView
      frames={emu.frames}
      frameLayout={emu.frameLayout}
      registers={emu.registers}
      sp={emu.sp}
      pc={emu.pc}
      getMemory={emu.getMemory}
      readMemory={emu.readMemory}
      dirtyAddrs={emu.dirtyAddrs}
      memoryRegions={emu.memoryRegions}
      lineLabel={emu.lineLabel}
      programLines={emu.programLines}
      noteRows={emu.noteRows}
      errorCard={emu.errorCard}
      programLoaded={emu.programLoaded}
      running={emu.isRunning}
    />
  );
}

/** A hub with the frames view up, and every text its status takes. */
async function mounted() {
  let hub: EmulatorState | null = null;
  const onHub = (h: EmulatorState) => {
    hub = h;
  };
  const view = render(<Stack shown onHub={onHub} />);
  await waitFor(() => expect(hub?.isLoaded).toBe(true));
  const heard: string[] = [];
  // Each change of the status's text, the space that marks a repeat
  // included; a view put back starts a new, empty status.
  let status: Element | null = null;
  let last = "";
  new MutationObserver(() => {
    const now = screen.queryByRole("status");
    const text = now?.textContent ?? "";
    if (now !== status) [status, last] = [now, text];
    else if (text !== last) {
      last = text;
      heard.push(text.trim());
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  const get = () => hub!;
  return {
    hub: get,
    heard,
    /** Hide the stack tab, then show it again. */
    remount: () => {
      view.rerender(<Stack shown={false} onHub={onHub} />);
      view.rerender(<Stack shown onHub={onHub} />);
    },
    load: async (source: string) => {
      await act(async () => {
        await expect(get().assemble(source)).resolves.toBe(true);
      });
    },
    /** A goal pressed as a button does it, so the view renders the run
     *  going and then its stop at `steps`. */
    press: async (target: StepTarget, steps: number) => {
      act(() => {
        void get().runUntil(target);
      });
      await waitFor(() => expect([get().isRunning, get().stepCount]).toEqual([false, steps]));
    },
    run: async (steps: number) => {
      act(() => {
        get().run();
      });
      await waitFor(() => expect([get().isRunning, get().stepCount]).toEqual([false, steps]));
    },
  };
}

/** Lets the status observer report what the last renders said. */
const heardSoFar = () => new Promise((done) => setTimeout(done, 0));
/** The cards as the status says them: each card's words, one after another. */
const cardText = () =>
  within(screen.getByRole("list", { name: "what went wrong" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent)
    .join(" ");
/** What the status said of the cards, past the call and return words
 *  ("helper called"), which have rules of their own. */
const cardsSaid = (heard: string[]) => heard.filter((text) => text.startsWith("Line ") || text.includes("'s ret on "));
/** The view's card once its word has come from the machine. */
const card = () => waitFor(() => expect(cardText()).toMatch(/ It now holds /)).then(cardText);

describe("the frames view on the hub", () => {
  // A breakpoint on line 33 stops each pass just after its store: steps 10,
  // 15, 20 and 25 write inside helper's own array, 30 to 45 over main's
  // saved fp and lr. Run on from 45, main's ret at 59 takes the overwritten
  // lr and the fetch at 60 faults, an error whose alert carries the card.
  it("says each write card a Run to a breakpoint stops on once, and leaves the bad return to the alert", async () => {
    const m = await mounted();
    await m.load(OVERRUN);
    act(() => {
      m.hub().toggleBreakpoint(33);
    });
    const said: string[] = [];
    for (const steps of [10, 15, 20, 25, 30, 35, 40, 45]) {
      await m.run(steps);
      if (steps >= 30) said.push((await card())!);
    }
    await heardSoFar();
    expect(m.heard).toEqual(said);
    act(() => {
      m.hub().toggleBreakpoint(33);
    });
    await m.run(60);
    expect(m.hub().error).toMatch(/main's ret on line 21 jumped to 0x700000006 instead of going back to the C runtime, because /);
    expect(m.hub().errorCard?.cause).toBe("overwritten");
    await heardSoFar();
    expect(m.heard).toEqual(said);
  });

  it("says the write card a run to cursor and a step over stop on once", async () => {
    const m = await mounted();
    await m.load(OVERRUN);
    // Run to cursor on line 33 stops at 10, 15, 20, 25, then 30 on the write
    // over main's saved fp.
    for (const steps of [10, 15, 20, 25, 30]) await m.press(33, steps);
    const at30 = await card();
    // Step over the add, b, cmp and b.ge (31 to 34), then the store at 35.
    for (const steps of [31, 32, 33, 34, 35]) await m.press("over", steps);
    const at35 = await card();
    await heardSoFar();
    expect(cardsSaid(m.heard)).toEqual([at30, at35]);
    expect(m.hub().error).toBeNull();
  });

  // read_name's scanf("%s") on line 26 reads 32 letters into a 16-byte
  // buffer at fp + 16: with the null, 33 bytes, over main's saved fp and lr
  // just above read_name's frame. Steps: stp, mov, bl read_name, stp, mov,
  // ldr, add, bl scanf (8), then the two trampoline words and the library
  // call (11), which step out runs to finish the call.
  it("says the write cards a step out of a library call stops on once", async () => {
    const m = await mounted();
    await m.load(`// read_name reads a word into a 16-byte buffer with scanf("%s").

define(fp, x29)
define(lr, x30)

name_s = 16                             // char name[16]: fp + 16 to fp + 31
alloc = -(16 + 16) & -16
dealloc = -alloc

.data
fmt_in:     .string "%s"
fmt_out:    .string "hello, %s\\n"

.text

// read_name(): reads a word into name and greets it (bug: no width limit)
        .balign 4
        .global read_name
read_name:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x0, =fmt_in
        add     x1, fp, name_s          // x1 = &name[0]
        bl      scanf
        ldr     x0, =fmt_out
        add     x1, fp, name_s
        bl      printf

        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      read_name

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`);
    act(() => {
      m.hub().pushStdin(`${"A".repeat(32)}\n`);
    });
    for (let i = 0; i < 8; i++) {
      act(() => {
        m.hub().step();
      });
      await waitFor(() => expect(m.hub().stepCount).toBe(i + 1));
    }
    await heardSoFar();
    m.heard.length = 0;
    await m.press("out", 11);
    const both = await card();
    expect(both).toMatch(/over main's saved fp\. .* over main's saved lr\. /);
    await heardSoFar();
    expect(cardsSaid(m.heard)).toEqual([both]);
  });

  // The card at step 30 (run to cursor on line 33, five times): said once
  // through the stack tab closed and opened and a Back onto it, and once
  // more after each new load: a reset and an assemble, an edit, and a run
  // from the start (an assemble of the same program).
  it("says a card once per load of the program", async () => {
    const m = await mounted();
    const to30 = async () => {
      for (const steps of [10, 15, 20, 25, 30]) await m.press(33, steps);
      return card();
    };
    await m.load(OVERRUN);
    const at30 = await to30();
    m.remount();
    act(() => {
      m.hub().step();
    });
    await waitFor(() => expect(m.hub().stepCount).toBe(31));
    act(() => {
      m.hub().stepBack();
    });
    await waitFor(() => expect(m.hub().stepCount).toBe(30));
    expect(await card()).toBe(at30);
    await heardSoFar();
    expect(cardsSaid(m.heard)).toEqual([at30]);

    act(() => {
      m.hub().reset();
    });
    await m.load(OVERRUN);
    await to30();
    await m.load(`${OVERRUN}// one more line\n`);
    await to30();
    await m.load(OVERRUN);
    await to30();
    await heardSoFar();
    expect(cardsSaid(m.heard)).toEqual([at30, at30, at30, at30]);
  });
});
