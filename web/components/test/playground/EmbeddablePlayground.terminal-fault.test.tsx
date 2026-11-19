// A program typed at the terminal pane that stops on a fault: the editor marks
// the faulting line, the keyboard stays in the pane, and the next command
// reaches the shell instead of the source. A fault from the run button still
// takes the student to the line. On the shipped hub and the node build, with
// the touch editor (a real focusable textarea) and xterm stubbed.
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
// The real editor, which a coarse pointer turns into the touch editor: a
// textarea that takes the focus the way Monaco does.
vi.mock("@/components/playground/lazy-editor", async () => ({
  Editor: (await import("@/components/playground/Editor")).Editor,
}));
// The surface and the terminal pane themselves, not their dynamic() wrappers,
// which load only on their first render and so leave a case run alone waiting.
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

// xterm stand-in: its helper textarea sits in the pane, takes the focus, and
// turns a key pressed on it into xterm's onKey and onData, so a key goes to
// whatever holds the focus, as in a browser.
const xterm = vi.hoisted(() => ({ writes: [] as string[] }));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    textarea = document.createElement("textarea");
    options: Record<string, unknown>;
    keyCb: ((e: { key: string; domEvent: KeyboardEvent }) => void) | null = null;
    dataCb: ((data: string) => void) | null = null;
    cols = 80;
    rows = 24;
    // The pane reads which screen a program left it on when a session ends.
    buffer = { active: { type: "normal" } };
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
      xterm.writes.push(s + "\n");
    }
    write(s: string) {
      xterm.writes.push(s);
    }
    clear() {}
    reset() {}
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

// A store through x0 = 0 on line 14, after a line of output.
const STORE_NULL = `// stores through a null pointer after one line of output
        .data
msg:    .string "before the fault\\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =msg
        bl      printf
        mov     x0, 0
        str     x1, [x0]
        ldp     x29, x30, [sp], 16
        ret
`;
const FAULT_LINE = 14;

function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

/** Presses each key on whatever holds the focus. A textarea the xterm stub
 *  does not own takes the character, as a browser's would. */
function typeAtFocus(text: string): void {
  for (const ch of text) {
    const el = document.activeElement as HTMLElement;
    const key = ch === "\r" ? "Enter" : ch;
    const typed = fireEvent.keyDown(el, { key });
    if (typed && el instanceof HTMLTextAreaElement) {
      const at = el.selectionStart;
      const next = el.value.slice(0, at) + (ch === "\r" ? "\n" : ch) + el.value.slice(el.selectionEnd);
      fireEvent.change(el, { target: { value: next } });
      el.setSelectionRange(at + 1, at + 1);
    }
  }
}

const source = () => (screen.getByLabelText("assembly source") as HTMLTextAreaElement).value;
/** Whether the editor's gutter marks line n as an error's. */
const marked = (n: number) =>
  document.querySelector(`[data-gutter-line="${n}"]`)!.className.includes("text-[var(--danger)] font-bold");
const pane = () => screen.getByRole("application", { name: "shell terminal" });
const exits = () => xterm.writes.filter((w) => w.includes("[no exit")).length;

const realMatchMedia = window.matchMedia;

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
  xterm.writes.length = 0;
  setWidth(800);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.matchMedia = realMatchMedia;
  vi.unstubAllGlobals();
  setWidth(1024);
  for (const emu of machines.splice(0)) emu.free();
});

/** The playground on STORE_NULL with the terminal pane open and focused. */
async function atTheShell() {
  render(<EmbeddablePlayground chrome="full" startSource={STORE_NULL} />);
  fireEvent.click(await screen.findByRole("tab", { name: "term" }, { timeout: 5000 }));
  const helper = await waitFor(() => {
    const t = pane().querySelector("textarea");
    expect(t).not.toBeNull();
    return t!;
  });
  act(() => helper.focus());
  return helper;
}

describe("a program run from the terminal pane that faults on a line", () => {
  it("marks the line and leaves the keyboard in the pane", async () => {
    const helper = await atTheShell();
    typeAtFocus("./program\r");
    await waitFor(() => expect(exits()).toBe(1), { timeout: 5000 });
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toMatch(new RegExp(`^line ${FAULT_LINE}: stopped: tried to write`));
    // Let the jump to the error line land, if one is coming.
    await act(() => new Promise((done) => setTimeout(done, 100)));
    expect(marked(FAULT_LINE)).toBe(true);
    expect(marked(FAULT_LINE - 1)).toBe(false);
    expect(document.activeElement).toBe(helper);
  }, 20_000);

  it("runs the next command typed straight after it, and leaves the source alone", async () => {
    await atTheShell();
    const before = source();
    typeAtFocus("./program\r");
    await waitFor(() => expect(exits()).toBe(1), { timeout: 5000 });
    await act(() => new Promise((done) => setTimeout(done, 100)));
    typeAtFocus("./program\r");
    await waitFor(() => expect(exits()).toBe(2), { timeout: 5000 });
    expect(source()).toBe(before);
  }, 20_000);
});

describe("a program run by the run button that faults on a line", () => {
  it("still takes the student to the line: caret at its start, focus in the editor", async () => {
    render(<EmbeddablePlayground chrome="full" startSource={STORE_NULL} />);
    fireEvent.click(await screen.findByRole("button", { name: "run" }, { timeout: 5000 }));
    await screen.findByRole("alert", {}, { timeout: 5000 });
    const editor = screen.getByLabelText("assembly source") as HTMLTextAreaElement;
    await waitFor(() => expect(document.activeElement).toBe(editor));
    const start = STORE_NULL.split("\n").slice(0, FAULT_LINE - 1).join("\n").length + 1;
    expect(editor.selectionStart).toBe(start);
    expect(marked(FAULT_LINE)).toBe(true);
    expect(marked(FAULT_LINE - 1)).toBe(false);
  }, 20_000);
});
