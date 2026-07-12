// pins the watch panel: expressions added through the form evaluate
// against the live register file, memory, and frame slots, errors render
// in the danger slot with the message, duplicates collapse, and the
// expression list persists in localStorage across mounts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WatchPanel } from "@/components/panels/WatchPanel";

const STORE_KEY = "aarch64-playground:watches";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const FP = 0x80000010;

function makeRegisters(): string[] {
  const regs = Array.from({ length: 31 }, () => "0x0000000000000000");
  regs[0] = "0x000000000000002a"; // x0 = 42
  regs[1] = "0xffffffff00000005"; // w1 masks to 5
  regs[29] = "0x0000000080000010"; // fp
  return regs;
}

// memory holds 0x63 (99) in the 8 bytes at fp+16, zero elsewhere
function seededMemory() {
  return vi.fn((addr: number, len: number) => {
    const out = new Uint8Array(len);
    if (addr === FP + 16) out[0] = 0x63;
    return out;
  });
}

function renderPanel() {
  const getMemory = seededMemory();
  const utils = render(
    <WatchPanel
      registers={makeRegisters()}
      sp="0x0000000080000000"
      pc={0}
      frameSlots={[{ offset: 16, name: "score1_s" }]}
      getMemory={getMemory}
    />,
  );
  return { getMemory, ...utils };
}

function addExpression(expr: string) {
  fireEvent.change(screen.getByLabelText("watch expression"), { target: { value: expr } });
  fireEvent.click(screen.getByRole("button", { name: "add" }));
}

describe("WatchPanel", () => {
  it("starts empty with the quiet hint and a zero count", () => {
    renderPanel();
    expect(screen.getByText("Watches stay quiet until you ask.")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("evaluates a register expression against the register file", () => {
    renderPanel();
    addExpression("x0");
    expect(screen.getByText("x0")).toBeTruthy();
    expect(screen.getByText("0x000000000000002a")).toBeTruthy();
    // the count follows the list and the input clears for the next entry
    expect(screen.getByText("1")).toBeTruthy();
    expect((screen.getByLabelText("watch expression") as HTMLInputElement).value).toBe("");
  });

  it("masks a w-register to its low 32 bits", () => {
    renderPanel();
    addExpression("w1");
    expect(screen.getByText("0x00000005")).toBeTruthy();
  });

  it("resolves a frame-slot alias and reads the bytes at fp plus offset", () => {
    const { getMemory } = renderPanel();
    addExpression("[fp, score1_s]");
    expect(getMemory).toHaveBeenCalledWith(FP + 16, 8);
    expect(screen.getByText("0x0000000000000063")).toBeTruthy();
  });

  it("shows the evaluator's error for an unknown register", () => {
    renderPanel();
    addExpression("x99");
    const error = screen.getByText("unknown register x99");
    expect(error.className).toContain("text-[var(--danger)]");
    expect(error.getAttribute("title")).toBe("unknown register x99");
  });

  it("shows the fallback error for unsupported syntax", () => {
    renderPanel();
    addExpression("foo!");
    expect(screen.getByText("unsupported expression")).toBeTruthy();
  });

  it("collapses duplicate expressions instead of listing them twice", () => {
    renderPanel();
    addExpression("x0");
    addExpression("x0");
    expect(screen.getAllByText("x0").length).toBe(1);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("persists expressions and restores them on a fresh mount", () => {
    const { unmount } = renderPanel();
    addExpression("x0");
    expect(JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]")).toEqual(["x0"]);
    unmount();
    renderPanel();
    expect(screen.getByText("x0")).toBeTruthy();
    expect(screen.getByText("0x000000000000002a")).toBeTruthy();
  });

  it("removes an expression and updates the store", () => {
    renderPanel();
    addExpression("x0");
    fireEvent.click(screen.getByRole("button", { name: "remove watch x0" }));
    // the row and its value are gone (the empty-state hint, which also
    // mentions x0, returns instead)
    expect(screen.queryByText("0x000000000000002a")).toBeNull();
    expect(screen.queryByRole("button", { name: "remove watch x0" })).toBeNull();
    expect(screen.getByText("Watches stay quiet until you ask.")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null")).toEqual([]);
  });
});
