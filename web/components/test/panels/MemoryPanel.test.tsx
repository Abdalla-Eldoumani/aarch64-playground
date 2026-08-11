// pins the memory panel contract: a hex-dump window read through
// getMemory from a typed base address, 16 rows of 16 byte cells plus
// an ascii gutter, jump targets rewriting the base, dirty ranges
// tinted so the last write stays visible, and the jump trigger naming the
// region the window is in (derived from the emulator's exported map).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import type { MemoryRegion } from "@/lib/emulator/memory-map";

// The bands as the wasm export delivers them, transcribed from the loader
// constants by hand (four 1 MiB sections from 0x00400000, the 1 MiB stack
// band under the 0x80000000 base).
const REGIONS: MemoryRegion[] = [
  { name: ".text", start: 0x00400000, end: 0x00500000 },
  { name: ".rodata", start: 0x00500000, end: 0x00600000 },
  { name: ".data", start: 0x00600000, end: 0x00700000 },
  { name: ".bss", start: 0x00700000, end: 0x00800000 },
  { name: "heap", start: 0x00900000, end: 0x00a00000 },
  { name: "stack", start: 0x7ff00000, end: 0x80000000 },
];

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// byte value = low 8 bits of its own address, so every re-read is
// address-sensitive and each value appears exactly once per 256-byte window
function seededMemory() {
  return vi.fn((addr: number, len: number) =>
    Uint8Array.from({ length: len }, (_, i) => (addr + i) & 0xff),
  );
}

function renderPanel(dirtyAddrs?: Array<[number, number]>) {
  const getMemory = seededMemory();
  const utils = render(<MemoryPanel getMemory={getMemory} dirtyAddrs={dirtyAddrs} />);
  return { getMemory, ...utils };
}

function renderMapped(sp?: string) {
  const getMemory = seededMemory();
  render(<MemoryPanel getMemory={getMemory} regions={REGIONS} sp={sp ?? null} />);
  return getMemory;
}

function addrInput(): HTMLInputElement {
  return screen.getByLabelText("memory base address") as HTMLInputElement;
}

function jumpTrigger(): HTMLButtonElement {
  return screen.getByRole("combobox", { name: "jump to section" }) as HTMLButtonElement;
}

function openJump(): void {
  fireEvent.click(jumpTrigger());
}

describe("MemoryPanel", () => {
  it("opens at .text and reads a 16x16 window from there", () => {
    const { getMemory, container } = renderPanel();
    expect(addrInput().value).toBe("0x00400000");
    expect(getMemory).toHaveBeenCalledWith(0x00400000, 256);
    expect(container.querySelectorAll("tbody tr").length).toBe(16);
    expect(screen.getByText("0x00400000")).toBeTruthy();
    expect(screen.getByText("0x00400010")).toBeTruthy();
    expect(screen.getByText("0x004000f0")).toBeTruthy();
  });

  it("heads the grid with one column per byte, 0 through F", () => {
    renderPanel();
    const heads = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(heads).toEqual([
      "addr",
      ...Array.from({ length: 16 }, (_, i) => i.toString(16).toUpperCase()),
      "ascii",
    ]);
  });

  it("renders bytes as two-digit hex and printable bytes in the ascii gutter", () => {
    renderPanel();
    // 0x00400041 holds 0x41; its row 0x00400040..0x0040004f spells out ascii
    expect(screen.getByText("41")).toBeTruthy();
    expect(screen.getByText("@ABCDEFGHIJKLMNO")).toBeTruthy();
    // the first row is all control bytes, so the gutter shows dots
    expect(screen.getAllByText("................").length).toBeGreaterThan(0);
  });

  it("re-reads from a typed base address", () => {
    const { getMemory } = renderPanel();
    fireEvent.change(addrInput(), { target: { value: "0x00500000" } });
    expect(getMemory).toHaveBeenLastCalledWith(0x00500000, 256);
    expect(screen.getByText("0x00500000")).toBeTruthy();
    expect(screen.queryByText("0x00400000")).toBeNull();
  });

  it("holds the window and says so on an unparseable address", () => {
    renderPanel();
    fireEvent.change(addrInput(), { target: { value: "zz" } });
    // The window stays at the last good address, with a visible verdict,
    // instead of silently reading address 0.
    expect(screen.getByRole("alert").textContent).toContain("hex");
    expect(screen.getByText("0x00400000")).toBeTruthy();
  });

  it("does not truncate a hex address at a mistyped character", () => {
    const { getMemory } = renderPanel();
    fireEvent.change(addrInput(), { target: { value: "0x00600000" } });
    expect(getMemory).toHaveBeenCalledWith(0x00600000, 256);
    // Capital O for zero: parseInt would have read 0x60 and silently
    // relocated the window; the strict parse holds at 0x00600000.
    fireEvent.change(addrInput(), { target: { value: "0x0060O000" } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("0x00600000")).toBeTruthy();
    expect(getMemory).not.toHaveBeenCalledWith(0x60, 256);
  });

  it("jumps to a named section from the select", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("combobox", { name: "jump to section" }));
    fireEvent.pointerDown(screen.getByText(".data"));
    expect(addrInput().value).toBe("0x00600000");
    expect(screen.getByText("0x00600000")).toBeTruthy();
  });

  it("tints exactly the bytes inside a dirty range", () => {
    renderPanel([[0x00400004, 2]]);
    // bytes at +4 and +5 hold 04 and 05; +6 sits just outside the range
    expect(screen.getByText("04").className).toContain("bg-[var(--amber-dim)]");
    expect(screen.getByText("05").className).toContain("bg-[var(--amber-dim)]");
    expect(screen.getByText("06").className).not.toContain("bg-[var(--amber-dim)]");
  });
});

describe("MemoryPanel region label", () => {
  it("names the region the window opens in", () => {
    renderMapped();
    expect(jumpTrigger().textContent).toContain("in .text");
  });

  it("follows a jump to another section", () => {
    renderMapped();
    openJump();
    fireEvent.pointerDown(screen.getByText(".bss"));
    expect(addrInput().value).toBe("0x00700000");
    expect(jumpTrigger().textContent).toContain("in .bss");
  });

  it("updates live for a typed address inside a section", () => {
    renderMapped();
    // Mid-.bss, not a band edge: the label follows the address, not the jump.
    fireEvent.change(addrInput(), { target: { value: "0x00712340" } });
    expect(jumpTrigger().textContent).toContain("in .bss");
  });

  it("says unmapped between bands", () => {
    renderMapped();
    // The gap between the heap's end and the stack floor.
    fireEvent.change(addrInput(), { target: { value: "0x00a00000" } });
    expect(jumpTrigger().textContent).toContain("unmapped");
  });

  it("keeps naming the last good window when an address is rejected", () => {
    renderMapped();
    fireEvent.change(addrInput(), { target: { value: "0x00600000" } });
    expect(jumpTrigger().textContent).toContain("in .data");
    fireEvent.change(addrInput(), { target: { value: "0x0060O000" } });
    // The window held at 0x00600000, so the label still describes it.
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(jumpTrigger().textContent).toContain("in .data");
  });

  it("lands the stack jump on the row holding a live sp", () => {
    renderMapped("0x000000007fffff08");
    openJump();
    fireEvent.pointerDown(screen.getByText("stack"));
    // 0x7fffff08 aligned down to the 16-byte row.
    expect(addrInput().value).toBe("0x7fffff00");
    expect(jumpTrigger().textContent).toContain("in stack");
  });

  it("keeps the fixed stack landing when sp is outside the band", () => {
    // A reset machine parks sp at the stack base, which is the band's
    // exclusive end: there is no live frame to land on.
    renderMapped("0x0000000080000000");
    openJump();
    fireEvent.pointerDown(screen.getByText("stack"));
    expect(addrInput().value).toBe("0x7fffff00");
  });

  it("falls back to the literal jump list and no label without the map", () => {
    renderPanel();
    // Old wasm build: nothing to name, so the trigger keeps its prompt and
    // the list is the panel's own.
    expect(jumpTrigger().textContent).toContain("jump...");
    openJump();
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual([".text", ".rodata", ".data", ".bss", "stack"]);
  });
});
