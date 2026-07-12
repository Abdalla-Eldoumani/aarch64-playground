// pins the memory panel contract: a hex-dump window read through
// getMemory from a typed base address, 16 rows of 16 byte cells plus
// an ascii gutter, jump targets rewriting the base, and dirty ranges
// tinted so the last write stays visible.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryPanel } from "@/components/panels/MemoryPanel";

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

function addrInput(): HTMLInputElement {
  return screen.getByLabelText("memory base address") as HTMLInputElement;
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

  it("treats an unparseable address as zero", () => {
    renderPanel();
    fireEvent.change(addrInput(), { target: { value: "zz" } });
    expect(screen.getByText("0x00000000")).toBeTruthy();
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
