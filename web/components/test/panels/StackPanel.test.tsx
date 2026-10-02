// pins the stack panel contract: sp parses from hex and anchors a
// 16-row by 8-byte window read through getMemory, values render as
// little-endian 64-bit numbers, the fp row and frame-slot labels appear only
// while fp is inside the window, and rows fall back to SP+N labels.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StackPanel } from "@/components/panels/StackPanel";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const SP = 0x80000000;

// row 0 gets bytes 01..08 so the little-endian value is recognizable;
// everything else reads as zero.
function seededMemory() {
  return vi.fn((addr: number, len: number) => {
    const out = new Uint8Array(len);
    if (addr === SP) for (let i = 0; i < 8; i++) out[i] = i + 1;
    return out;
  });
}

function renderPanel(overrides: Partial<Parameters<typeof StackPanel>[0]> = {}) {
  const getMemory = seededMemory();
  const utils = render(
    <StackPanel sp="0x80000000" getMemory={getMemory} {...overrides} />,
  );
  return { getMemory, ...utils };
}

describe("StackPanel window", () => {
  it("parses sp from hex and shows it padded to 16 digits", () => {
    renderPanel({ sp: "0x7ffffe80" });
    expect(screen.getByText("SP = 0x000000007ffffe80")).toBeTruthy();
  });

  it("falls back to the stack base when sp does not parse", () => {
    renderPanel({ sp: "" });
    expect(screen.getByText("SP = 0x0000000080000000")).toBeTruthy();
  });

  it("renders a genuinely zero SP as zero, not as a fresh stack", () => {
    // mov sp, x29 with x29 never set: the register panel says SP = 0 and
    // this panel must agree instead of fabricating 0x80000000.
    renderPanel({ sp: "0x0" });
    expect(screen.getByText("SP = 0x0000000000000000")).toBeTruthy();
  });

  it("reads exactly 16 rows of 8 bytes starting at sp", () => {
    const { getMemory, container } = renderPanel();
    expect(getMemory).toHaveBeenCalledWith(SP, 128);
    expect(container.querySelectorAll("tbody tr").length).toBe(16);
    // first and last row addresses bound the 128-byte window
    expect(screen.getByText("0x80000000")).toBeTruthy();
    expect(screen.getByText("0x80000078")).toBeTruthy();
  });

  it("reads each 8-byte slot as a little-endian 64-bit number", () => {
    renderPanel();
    // bytes 01 02 03 04 05 06 07 08 read back most-significant-last
    expect(screen.getByText("0x0807060504030201")).toBeTruthy();
    expect(screen.getAllByText("0x0000000000000000").length).toBe(15);
  });

  it("dims zero slots and marks the sp row amber", () => {
    const { container } = renderPanel();
    const nonZero = screen.getByText("0x0807060504030201");
    expect(nonZero.className).toContain("text-[var(--text-primary)]");
    const zero = screen.getAllByText("0x0000000000000000")[0];
    expect(zero.className).toContain("text-[var(--text-secondary)]");
    const firstRow = container.querySelector("tbody tr") as HTMLElement;
    expect(firstRow.className).toContain("text-[var(--amber)]");
  });
});

describe("StackPanel fp marker and labels", () => {
  it("marks the fp row and labels offsets relative to fp while fp is in view", () => {
    renderPanel({ fp: SP + 16, frameSlots: [{ offset: 8, name: "count_s" }] });
    expect(screen.getByText("FP = 0x0000000080000010")).toBeTruthy();
    // the slot at fp itself
    const fpCell = screen.getByText("fp");
    expect(fpCell.closest("tr")?.className).toContain("text-[var(--success)]");
    // fp+8 carries the parsed frame-slot name
    const named = screen.getByText("count_s");
    expect(named.parentElement?.textContent).toBe("[fp, 8] count_s");
    // fp+16 has no name and falls back to the numeric offset
    expect(screen.getByText("[fp, 16]")).toBeTruthy();
    // rows below fp keep the SP-relative label
    expect(screen.getByText("SP+0")).toBeTruthy();
    expect(screen.getByText("SP+8")).toBeTruthy();
  });

  it("drops the fp marker and slot labels once fp leaves the window", () => {
    renderPanel({ fp: SP + 128, frameSlots: [{ offset: 8, name: "count_s" }] });
    expect(screen.queryByText("fp")).toBeNull();
    expect(screen.queryByText("count_s")).toBeNull();
    // every row labels itself relative to sp instead
    expect(screen.getByText("SP+0")).toBeTruthy();
    expect(screen.getByText("SP+120")).toBeTruthy();
  });

  it("shows no fp readout at all when fp is absent", () => {
    renderPanel();
    expect(screen.queryByText(/^FP = /)).toBeNull();
    expect(screen.queryByText("fp")).toBeNull();
  });
});

describe("StackPanel 32-bit slots", () => {
  // Two int locals, a = 7 at [fp, 16] and b = 5 at [fp, 20], with fp = sp.
  function intLocals() {
    return vi.fn((addr: number, len: number) => {
      const out = new Uint8Array(len);
      if (addr === SP) {
        out[16] = 7;
        out[20] = 5;
      }
      return out;
    });
  }
  const slots = [
    { offset: 16, name: "a_s" },
    { offset: 20, name: "b_s" },
  ];

  it("reads 8 bytes a row by default, so two int locals share one number", () => {
    render(<StackPanel sp="0x80000000" getMemory={intLocals()} fp={SP} frameSlots={slots} />);
    const row = screen.getByText("a_s").closest("tr");
    expect(row?.textContent).toContain("0x0000000500000007");
    expect(screen.queryByText("b_s")).toBeNull();
  });

  it("splits the same 128 bytes into 32 rows of 4, each local on its own row with its offset", () => {
    const { container } = render(
      <StackPanel sp="0x80000000" getMemory={intLocals()} fp={SP} frameSlots={slots} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "32-bit" }));
    expect(screen.getByRole("button", { name: "32-bit" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("value (32-bit)")).toBeTruthy();
    expect(container.querySelectorAll("tbody tr").length).toBe(32);
    const a = screen.getByText("a_s").closest("tr");
    const b = screen.getByText("b_s").closest("tr");
    expect(a).not.toBe(b);
    expect(a?.textContent).toContain("0x00000007");
    expect(a?.textContent).toContain("[fp, 16] a_s");
    expect(b?.textContent).toContain("0x00000005");
    expect(b?.textContent).toContain("[fp, 20] b_s");
    expect(screen.getByText("0x80000004")).toBeTruthy();
  });

  it("keeps the choice for the next visit", () => {
    render(<StackPanel sp="0x80000000" getMemory={intLocals()} />);
    fireEvent.click(screen.getByRole("button", { name: "32-bit" }));
    cleanup();
    const { container } = render(<StackPanel sp="0x80000000" getMemory={intLocals()} />);
    expect(container.querySelectorAll("tbody tr").length).toBe(32);
  });
});
