// A raw-mode program the terminal pane takes over from a run it did not start:
// with the pane already open (here hidden behind the console tab), a Run in the
// console or gdb's continue at the pane's prompt wipes the pane and replays the
// program's setup (mouse reporting on, its first frame), which reached the
// console before the pane could attach. On the shipped hub and the node build,
// with xterm stubbed.
import { createRequire } from "node:module";
import path from "node:path";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("@/components/playground/lazy-editor", async () => ({
  Editor: (await import("@/components/playground/Editor")).Editor,
}));
// The surface and the terminal pane themselves, not their dynamic() wrappers,
// which load only on their first render.
vi.mock("@/components/playground/lazy-full-chrome", async () => ({
  FullChromeSurface: (await import("@/components/playground/FullChromeSurface")).FullChromeSurface,
}));
vi.mock("@/components/playground/lazy-panels", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/playground/lazy-panels")>()),
  TerminalPane: (await import("@/components/panels/TerminalPane")).TerminalPane,
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

// xterm stand-in: what reached the pane, in order, a wipe as its own entry.
const xterm = vi.hoisted(() => ({ log: [] as string[] }));
const WIPE = "<wipe>";
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    textarea = document.createElement("textarea");
    options: Record<string, unknown>;
    keyCb: ((e: { key: string; domEvent: KeyboardEvent }) => void) | null = null;
    dataCb: ((data: string) => void) | null = null;
    cols = 80;
    rows = 24;
    buffer = { active: { type: "normal" } };
    // The pane clamps control-sequence counts through the core's parser.
    _core = { registerCsiHandler: () => ({ dispose() {} }) };
    constructor(options: Record<string, unknown> = {}) {
      this.options = { ...options };
      this.textarea.addEventListener("keydown", (e) => {
        const key = e.key === "Enter" ? "\r" : e.key;
        this.keyCb?.({ key, domEvent: e });
        this.dataCb?.(key);
        e.preventDefault();
      });
    }
    open(container: HTMLElement) {
      container.appendChild(this.textarea);
    }
    focus() {
      this.textarea.focus();
    }
    blur() {
      this.textarea.blur();
    }
    loadAddon(addon: { activate?: (term: unknown) => void }) {
      addon.activate?.(this);
    }
    attachCustomKeyEventHandler() {}
    writeln(s: string) {
      xterm.log.push(s + "\n");
    }
    write(s: string) {
      xterm.log.push(s);
    }
    clear() {}
    reset() {
      xterm.log.push(WIPE);
    }
    dispose() {}
    onKey(cb: (e: { key: string; domEvent: KeyboardEvent }) => void) {
      this.keyCb = cb;
      return { dispose: () => {} };
    }
    onData(cb: (data: string) => void) {
      this.dataCb = cb;
      return { dispose: () => {} };
    }
    onResize() {
      return { dispose: () => {} };
    }
  },
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    activate() {}
    proposeDimensions() {
      return { cols: 80, rows: 24 };
    }
    fit() {}
  },
}));
vi.mock("@/lib/playground/vfs-persist", () => ({
  loadPersistedVfs: vi.fn(async () => null),
  savePersistedVfs: vi.fn(async () => {}),
}));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";

// Turns raw mode on, turns mouse reporting on and draws, all in its first
// chunk, then waits for a key.
const RAW = `// raw mode, mouse reporting and a frame, then a read
TCGETS = 0x5401
TCSETS = 0x5402
ICANON = 0x0002
SYS_IOCTL = 29
SYS_READ = 63
SYS_WRITE = 64

        .data
termios:        .skip 60
setup:          .ascii "\\x1b[?1000h\\x1b[?1006hRAWFRAME"
setup_len = . - setup
key:            .skip 1

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x0, 0
        mov     x1, TCGETS
        ldr     x2, =termios
        mov     x8, SYS_IOCTL
        svc     0
        ldr     x2, =termios
        ldr     w1, [x2, 12]
        mov     w3, ICANON
        bic     w1, w1, w3
        str     w1, [x2, 12]
        mov     x0, 0
        mov     x1, TCSETS
        mov     x8, SYS_IOCTL
        svc     0
        mov     x0, 1
        ldr     x1, =setup
        mov     x2, setup_len
        mov     x8, SYS_WRITE
        svc     0
        mov     x0, 0
        ldr     x1, =key
        mov     x2, 1
        mov     x8, SYS_READ
        svc     0
        mov     x0, 0
        ldp     x29, x30, [sp], 16
        ret
`;
const SETUP = "\x1b[?1000h\x1b[?1006hRAWFRAME";

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

const pane = () => screen.getByRole("application", { name: "shell terminal" });

/** The playground on RAW with the terminal pane opened once, so it is mounted. */
async function withThePaneOpen() {
  render(<EmbeddablePlayground chrome="full" startSource={RAW} />);
  fireEvent.click(await screen.findByRole("tab", { name: "term" }, { timeout: 5000 }));
  const helper = await waitFor(() => {
    const t = pane().querySelector("textarea");
    expect(t).not.toBeNull();
    return t!;
  });
  return helper;
}

/** Whatever reached the pane after its wipe, joined. */
const afterWipe = () => {
  const at = xterm.log.lastIndexOf(WIPE);
  return at < 0 ? null : xterm.log.slice(at + 1).join("");
};

const realMatchMedia = window.matchMedia;

// A tablet's width, where the two fixed columns (split mocked to render both)
// hold the debug tabs; a coarse pointer, so the editor is the touch textarea.
beforeEach(() => {
  window.localStorage.setItem("aarch64-playground:backend", "main");
  window.matchMedia = ((query: string) => ({
    ...realMatchMedia(query),
    matches: query === "(pointer: coarse)",
  })) as typeof window.matchMedia;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  xterm.log.length = 0;
  setWidth(800);
});

afterEach(async () => {
  cleanup();
  // RAW still waits for its key: the drive stands down at its next 32 ms poll
  // and puts the machine back, so the machines are freed after that.
  await new Promise((done) => setTimeout(done, 100));
  localStorage.clear();
  window.matchMedia = realMatchMedia;
  vi.unstubAllGlobals();
  setWidth(1024);
  for (const emu of machines.splice(0)) emu.free();
});

describe("a raw-mode program the pane takes over from a run it did not start", () => {
  it("wipes the open pane and replays the program's setup after a Run in the console", async () => {
    await withThePaneOpen();
    // The pane stays mounted behind another tab.
    fireEvent.click(screen.getByRole("tab", { name: "console" }));
    xterm.log.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "run" }));
    await waitFor(() => expect(afterWipe()).toContain(SETUP), { timeout: 10_000 });
    expect(xterm.log.filter((entry) => entry === WIPE)).toHaveLength(1);
  }, 20_000);

  it("does the same for gdb's continue at the pane's prompt", async () => {
    const helper = await withThePaneOpen();
    // gdb runs the program the editor assembled.
    fireEvent.click(screen.getAllByRole("button", { name: "assemble" })[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "step" }).hasAttribute("disabled")).toBe(false), {
      timeout: 10_000,
    });
    xterm.log.length = 0;
    act(() => helper.focus());
    for (const key of "gdb c\r") fireEvent.keyDown(helper, { key: key === "\r" ? "Enter" : key });
    await waitFor(() => expect(afterWipe()).toContain(SETUP), { timeout: 10_000 });
    expect(xterm.log.filter((entry) => entry === WIPE)).toHaveLength(1);
  }, 20_000);
});
