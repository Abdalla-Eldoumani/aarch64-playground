import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import path from "node:path";
import { createRequire } from "node:module";
import type { FrameExercise } from "@/lib/content/exercise-schema";
import { loadAllExercises } from "@/lib/content/exercises";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { isSolved } from "@/lib/playground/solved-state";
import { FrameExerciseView } from "@/components/practice/FrameExerciseView";

// The draw-the-frame sheet on the real emulator: Check runs the shipped
// program to its pause on the page's headless machine, here the node build.
// The frame is worked by hand from the program's equates: count_s 16,
// sum_s 24, last_s 32, a 48-byte frame, saved fp at fp + 0 and lr at fp + 8.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js")) as typeof import("@/lib/wasm-node/aarch64_emulator");
const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

vi.mock("@/lib/emulator/emulator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/emulator/emulator")>()),
  loadEmulator: async () => machine,
}));

const LOCALS = loadAllExercises().find((exercise) => exercise.slug === "draw-frame-locals") as FrameExercise;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function fill(values: { size: string; count: string; sum: string; last: string; fp: string; lr: string }) {
  fireEvent.change(screen.getByLabelText("frame size in bytes"), { target: { value: values.size } });
  fireEvent.change(screen.getByLabelText("offset of count_s from fp, in bytes"), { target: { value: values.count } });
  fireEvent.change(screen.getByLabelText("offset of sum_s from fp, in bytes"), { target: { value: values.sum } });
  fireEvent.change(screen.getByLabelText("offset of last_s from fp, in bytes"), { target: { value: values.last } });
  fireEvent.change(screen.getByLabelText("offset of the saved fp from fp, in bytes"), { target: { value: values.fp } });
  fireEvent.change(screen.getByLabelText("offset of the saved lr from fp, in bytes"), { target: { value: values.lr } });
}

const RIGHT = { size: "48", count: "16", sum: "24", last: "32", fp: "0", lr: "8" };

async function checked(): Promise<string> {
  fireEvent.click(screen.getByRole("button", { name: "check" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/right|reached|load/));
  return screen.getByRole("status").textContent ?? "";
}

const frameSection = () => screen.getByRole("region", { name: "the frame at the pause" });

describe("FrameExerciseView", () => {
  it("shows the program with its pause line marked, and a labelled number field for every box", () => {
    render(<FrameExerciseView exercise={LOCALS} />);
    const program = screen.getByRole("region", { name: "the program" });
    expect(within(program).getByText("(paused before this line)")).toBeTruthy();
    expect(program.textContent).toContain("Paused before line 55 runs.");
    const inputs = within(frameSection()).getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
    for (const input of inputs) {
      expect(input.getAttribute("inputmode")).toBe("numeric");
      expect(input.className).toContain("text-[16px]");
      expect(input.className).toContain("min-h-[44px]");
    }
    // High address first: last_s on top, the saved fp at the bottom.
    const boxes = within(screen.getByRole("list", { name: "the frame, high address first" })).getAllByRole("listitem");
    const label = (box: HTMLElement) => box.querySelector("label")?.textContent ?? "";
    expect(boxes.map((box) => box.textContent?.replace(label(box), "").replace("fp +", "").trim())).toEqual([
      "last_s",
      "sum_s",
      "count_s",
      "saved lr (x30)",
      "saved fp (x29)",
    ]);
    expect(boxes.map(label)).toEqual([
      "offset of last_s from fp, in bytes",
      "offset of sum_s from fp, in bytes",
      "offset of count_s from fp, in bytes",
      "offset of the saved lr from fp, in bytes",
      "offset of the saved fp from fp, in bytes",
    ]);
  });

  it("marks a right frame right in every field and records the exercise solved", async () => {
    render(<FrameExerciseView exercise={LOCALS} />);
    fill(RIGHT);
    expect(await checked()).toBe("all 6 right");
    expect(within(frameSection()).getAllByText("passed")).toHaveLength(6);
    expect(isSolved(LOCALS.slug)).toBe(true);
  });

  it("marks each wrong field with its hint and never shows the number it wanted", async () => {
    render(<FrameExerciseView exercise={LOCALS} />);
    fill({ size: "36", count: "16", sum: "20", last: "28", fp: "8", lr: "0" });
    expect(await checked()).toBe("1 of 6 right");
    const section = frameSection();
    expect(within(section).getByText(LOCALS.hints.size)).toBeTruthy();
    expect(within(section).getByText(LOCALS.slots[1].hint)).toBeTruthy();
    expect(within(section).getByText(LOCALS.slots[2].hint)).toBeTruthy();
    expect(within(section).getByText(LOCALS.hints.savedFp)).toBeTruthy();
    expect(within(section).getByText(LOCALS.hints.savedLr)).toBeTruthy();
    expect(within(section).queryByText(LOCALS.slots[0].hint)).toBeNull();
    const size = screen.getByLabelText("frame size in bytes");
    expect(size.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(size.getAttribute("aria-describedby") ?? "")?.textContent).toBe(LOCALS.hints.size);
    // The wanted 48, 24 and 32 appear nowhere in the frame or the status.
    expect(section.textContent).not.toMatch(/\b(48|24|32)\b/);
    expect(isSolved(LOCALS.slug)).toBe(false);
  });

  it("says how to type a field that is empty or not a number, whatever was pasted in", async () => {
    render(<FrameExerciseView exercise={LOCALS} />);
    fill({ ...RIGHT, size: "9".repeat(100_000), sum: "0x18", last: "" });
    expect(await checked()).toBe("3 of 6 right");
    const section = frameSection();
    expect(within(section).getAllByText("Type a whole number of bytes, digits only.")).toHaveLength(2);
    expect(within(section).getByText("Type a number of bytes here.")).toBeTruthy();
    expect(within(section).getAllByText("not a number")).toHaveLength(2);
  });

  it("drops a field's mark once it is changed, until the next check", async () => {
    render(<FrameExerciseView exercise={LOCALS} />);
    fill({ ...RIGHT, size: "36" });
    await checked();
    expect(within(frameSection()).getByText(LOCALS.hints.size)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("frame size in bytes"), { target: { value: "48" } });
    expect(within(frameSection()).queryByText(LOCALS.hints.size)).toBeNull();
    expect(within(frameSection()).getAllByText("passed")).toHaveLength(5);
    expect(await checked()).toBe("all 6 right");
  });

  // On a slow phone the server's fields take numbers before the page's script
  // runs; hydration keeps the text but no change for it reaches the sheet.
  it("grades and keeps the numbers typed before the page's script ran", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(<FrameExerciseView exercise={LOCALS} />);
    const typed: [string, string][] = [
      ["frame size in bytes", RIGHT.size],
      ["offset of count_s from fp, in bytes", RIGHT.count],
      ["offset of sum_s from fp, in bytes", RIGHT.sum],
      ["offset of last_s from fp, in bytes", RIGHT.last],
      ["offset of the saved fp from fp, in bytes", RIGHT.fp],
      ["offset of the saved lr from fp, in bytes", RIGHT.lr],
    ];
    for (const [label, value] of typed) (within(container).getByLabelText(label) as HTMLInputElement).value = value;
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <FrameExerciseView exercise={LOCALS} />);
    });
    expect(await checked()).toBe("all 6 right");
    expect(typed.map(([label]) => (screen.getByLabelText(label) as HTMLInputElement).value)).toEqual(typed.map(([, v]) => v));
    act(() => root?.unmount());
    container.remove();
  });

  it("says so when the program never reaches its pause", async () => {
    render(<FrameExerciseView exercise={{ ...LOCALS, pause: { line: 55, hit: 2 } }} />);
    fill(RIGHT);
    expect(await checked()).toBe("the program never reached its pause, so there is no frame to check");
  });
});
