// A pressed pointer chip shows its slot wherever the playground runs: a
// lesson or practice frame swaps its registers for the stack (and its
// one-pane switch reads stack, as on a phone), and /playground opens the
// stack tab on its frames, on a tablet and on a phone. The slot is lit, and
// the focus moves to the frames when the chip's own pane went away. The
// machine is the node build on locals.s at its scanf: x1 points at a_s.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: () => <div data-testid="console" />,
}));
// The tablet arrangement shows the registers beside the tab strip; the
// splits themselves need a ResizeObserver jsdom lacks.
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div>
      {first}
      {second}
    </div>
  ),
  EDITOR_SPLIT: { label: "resize editor and disassembly" },
  DEBUG_SPLIT: { label: "resize registers and tabs" },
  FRAMES_SPLIT: { label: "resize registers and tabs" },
}));
const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import { nodeMachine } from "@/components/test/playground/helpers/node-machine";

const machine = nodeMachine("public/examples/cpsc355/locals.s", "7 4\n");
machine.runTo("bl      scanf");
const hub = () => makeHub({ ...machine.state(), programLoaded: true });

beforeAll(async () => {
  await import("@/components/playground/FullChromeSurface");
  await import("@/components/panels/FramesView");
  await import("@/components/panels/PointerChips");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterAll(() => machine.emu.free());

function setSize(width: number, height = 900): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

const X1 = /^x1 points to a_s in main's frame\. Show it in the stack\.$/;

/** The lit box's title, after the frames have arrived. */
async function litSlot() {
  const frames = await screen.findByRole("group", { name: "stack frames" });
  const lit = frames.querySelectorAll("[data-lit]");
  expect(lit).toHaveLength(1);
  return { frames, title: lit[0].children[1].firstElementChild!.textContent };
}

describe("pressing a pointer chip", () => {
  it.each(["embed", "checker"] as const)("in a %s frame swaps the registers for the stack, on the slot", async (chrome) => {
    useEmulatorMock.mockReturnValue(hub());
    const { container } = render(<EmbeddablePlayground chrome={chrome} startSource="// locals" />);
    act(() => {
      fireEvent.mouseDown(container.firstChild as Element);
    });
    // A phone shows one pane: its registers view first, then the chip.
    const view = screen.getByRole("group", { name: "view" });
    fireEvent.click(within(view).getByRole("button", { name: "registers" }));
    fireEvent.click(await screen.findByRole("button", { name: X1 }));
    const { frames, title } = await litSlot();
    expect(title).toBe("a_s = 0");
    expect(screen.queryByRole("group", { name: "register values" })).toBeNull();
    const side = screen.getByRole("group", { name: "registers or stack" });
    expect(within(side).getByRole("button", { name: "stack" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(view).getByRole("button", { name: "stack" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(frames);
  });

  it("on /playground opens the stack tab on its frames beside the registers", async () => {
    setSize(900);
    useEmulatorMock.mockReturnValue(hub());
    // A viewer who left the stack tab on its bytes.
    window.localStorage.setItem("aarch64-playground:stack-bytes", "1");
    render(<EmbeddablePlayground chrome="full" startSource="// locals" />);
    const chip = await screen.findByRole("button", { name: X1 });
    fireEvent.mouseEnter(chip);
    fireEvent.click(chip);
    expect((await screen.findByRole("tab", { name: "stack" })).getAttribute("aria-selected")).toBe("true");
    const { title } = await litSlot();
    expect(title).toBe("a_s = 0");
    expect(within(screen.getByRole("group", { name: "frames or bytes" })).getByRole("button", { name: "frames" }).getAttribute("aria-pressed")).toBe("true");
    // The chip stays under the mouse, and so does the focus it had.
    expect(screen.getByRole("group", { name: "register values" })).toBeTruthy();
    fireEvent.mouseLeave(chip);
    expect(screen.getByRole("group", { name: "stack frames" }).querySelector("[data-lit]")).toBeNull();
  });

  it("on a phone's /playground goes from the registers view to the stack view on the slot", async () => {
    setSize(390, 844);
    useEmulatorMock.mockReturnValue(hub());
    render(<EmbeddablePlayground chrome="full" startSource="// locals" />);
    fireEvent.click(await screen.findByRole("tab", { name: "registers" }));
    fireEvent.click(await screen.findByRole("button", { name: X1 }));
    const { title } = await litSlot();
    expect(title).toBe("a_s = 0");
  });

  // The press left the registers view, chip and all, so only the playground's
  // own pointer is there to see a run start.
  it("on a phone's /playground lets go of the pressed slot when a run starts from the stack view", async () => {
    setSize(390, 844);
    useEmulatorMock.mockReturnValue(hub());
    const view = () => <EmbeddablePlayground chrome="full" startSource="// locals" />;
    const { rerender } = render(view());
    fireEvent.click(await screen.findByRole("tab", { name: "registers" }));
    fireEvent.click(await screen.findByRole("button", { name: X1 }));
    await litSlot();
    useEmulatorMock.mockReturnValue({ ...hub(), isRunning: true });
    rerender(view());
    useEmulatorMock.mockReturnValue(hub());
    rerender(view());
    expect(screen.getByRole("group", { name: "stack frames" }).querySelector("[data-lit]")).toBeNull();
  });
});
