// An exercise check after a Run that ended on a fault grades the exercise's
// own run (its input, then end of input), never the faulted Run, which may
// have read input the student typed. On the shipped hub and the node build.
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

import { EmbeddablePlayground, type EmbeddableState } from "@/components/playground/EmbeddablePlayground";

beforeEach(() => {
  window.localStorage.setItem("aarch64-playground:backend", "main");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  for (const emu of machines.splice(0)) emu.free();
});

// With no number to read it says so and exits 0; given 0 it loads through
// it on line 18 and faults.
const READS = `// reads a number; with none it says so, with 0 it loads through it
        .data
fmt:    .string "%ld"
none:   .string "no number\\n"

        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -32]!
        mov     x29, sp
        ldr     x0, =fmt
        add     x1, x29, 16
        bl      scanf
        cmp     w0, 1
        b.ne    no_number
        ldr     x9, [x29, 16]
        ldr     x0, [x9]
        b       done
no_number:
        ldr     x0, =none
        bl      printf
done:
        mov     w0, 0
        ldp     x29, x30, [sp], 32
        ret
`;

describe("an exercise check after a Run that faulted", () => {
  it("grades the exercise's own run, not the Run that read typed input", async () => {
    const onCheck = vi.fn();
    render(<EmbeddablePlayground chrome="checker" startSource={READS} onCheck={onCheck} />);
    // The exercise gives no input. The Run keeps input open, waits at the
    // read, and the student types 0, which the program loads through.
    const run = await screen.findByRole("button", { name: "run" }, { timeout: 5000 });
    fireEvent.mouseDown(run);
    fireEvent.click(run);
    const input = await screen.findByLabelText("Standard input", {}, { timeout: 5000 });
    await act(() => new Promise((done) => setTimeout(done, 300)));
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/^line 18: stopped: tried to read from address 0x0/), {
      timeout: 5000,
    });

    fireEvent.click(screen.getByLabelText("check"));
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1), { timeout: 10_000 });
    // With no input and end of input, scanf reads nothing.
    expect(onCheck.mock.calls[0][0] as EmbeddableState).toMatchObject({
      stdout: "no number\n",
      exitCode: 0,
      error: null,
    });
  }, 30_000);
});
