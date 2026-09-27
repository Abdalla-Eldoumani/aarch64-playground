import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegisterPanel } from "@/components/panels/RegisterPanel";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GPRS = Array.from({ length: 31 }, () => "0x0000000000000000");
const FPRS = Array.from({ length: 32 }, () => "0x0000000000000000");

function renderPanel(fpRegisters: string[] = FPRS) {
  render(
    <RegisterPanel
      registers={GPRS}
      changedRegs={new Set()}
      fpRegisters={fpRegisters}
      changedFpRegs={new Set()}
      sp="0x0000000080000000"
      pc={0x400000}
      nzcv={0}
    />,
  );
}

describe("RegisterPanel d-register view", () => {
  it("hides the x/d switch entirely when the wasm exposes no fp registers", () => {
    renderPanel([]);
    expect(screen.queryByRole("group", { name: "register view" })).toBeNull();
    expect(screen.getByText("X0")).toBeTruthy();
  });

  it("switches between the integer and fp files and persists the choice", () => {
    renderPanel();
    expect(screen.getByText("X0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "d0–d31" }));
    expect(screen.getByText("D0")).toBeTruthy();
    expect(screen.getByText("D31")).toBeTruthy();
    expect(screen.queryByText("X0")).toBeNull();
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("d");
  });

  it("keeps the regfile switch at full size when the panel is narrow", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "register view" });
    expect(group.className).toContain("shrink-0");
    // The header wraps instead of squeezing the switch, so each cell keeps its
    // label on one line.
    for (const label of ["x0–x30", "d0–d31"]) {
      const cell = screen.getByRole("button", { name: label });
      expect(cell.className).toContain("shrink-0");
      expect(cell.className).toContain("whitespace-nowrap");
    }
    expect(group.parentElement?.className).toContain("flex-wrap");
    expect(group.parentElement?.className).toContain("gap-y-1");
  });

  it("gives each view its own dec/hex toggle, under its own key", () => {
    renderPanel();
    // The x-view's toggle is the integer one; the d-view's keeps the key it
    // shipped with, so a returning student's choice survives the split.
    expect(screen.getByRole("group", { name: "integer value format" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "fp value format" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dec" }));
    expect(window.localStorage.getItem("aarch64-playground:regfile-x-dec")).toBe("1");
    // Every register in this fixture holds zero, SP and PC excepted (both
    // addresses, both still hex): signed and unsigned agree, so each row is
    // one line with no unsigned reading under it.
    expect(screen.getAllByText("0")).toHaveLength(31);
    expect(screen.queryByText(/^\d+u$/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "d0–d31" }));
    expect(screen.queryByRole("group", { name: "integer value format" })).toBeNull();
    expect(screen.getByRole("group", { name: "fp value format" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "hex" }));
    expect(window.localStorage.getItem("aarch64-playground:regfile-fp-hex")).toBe("1");
  });

  it("lands a returning student back on the file the two-view flag stored", () => {
    window.localStorage.setItem("aarch64-playground:regfile-view", "1");
    renderPanel();
    expect(screen.getByText("D0")).toBeTruthy();
  });
});

describe("RegisterPanel auto-follow", () => {
  function renderLive(changedRegs: Set<number>, changedFpRegs: Set<number>) {
    return render(
      <RegisterPanel
        registers={GPRS}
        changedRegs={changedRegs}
        fpRegisters={FPRS}
        changedFpRegs={changedFpRegs}
        sp="0x0000000080000000"
        pc={0x400000}
        nzcv={0}
      />,
    );
  }

  it("follows a floating-point write into the d-file", () => {
    const { rerender } = renderLive(new Set(), new Set());
    expect(screen.getByText("X0")).toBeTruthy();
    rerender(
      <RegisterPanel
        registers={GPRS}
        changedRegs={new Set()}
        fpRegisters={FPRS}
        changedFpRegs={new Set([0])}
        sp="0x0000000080000000"
        pc={0x400000}
        nzcv={0}
      />,
    );
    expect(screen.getByText("D0")).toBeTruthy();
    expect(screen.queryByText("X0")).toBeNull();
  });

  it("follows an integer write back into the x-file", () => {
    const { rerender } = renderLive(new Set(), new Set([0]));
    expect(screen.getByText("D0")).toBeTruthy();
    rerender(
      <RegisterPanel
        registers={GPRS}
        changedRegs={new Set([19])}
        fpRegisters={FPRS}
        changedFpRegs={new Set()}
        sp="0x0000000080000000"
        pc={0x400000}
        nzcv={0}
      />,
    );
    expect(screen.getByText("X19")).toBeTruthy();
    expect(screen.queryByText("D0")).toBeNull();
  });

  it("reads a register written as dN as a double, and one written as sN as a float", () => {
    // fmov d0, x1 executed with x1 = 1: the bits are the smallest double
    // subnormal, which read as an s write's float would be 1e-45f.
    const source = "        fmov    d0, x1\n        fmov    s1, w2\n        mov     x9, sp\n";
    // The panel reads the executed line off the previous snapshot, which it
    // keeps whenever the vector file moves.
    const step = (fp: string[], written: number, line: number) => (
      <RegisterPanel
        registers={GPRS}
        changedRegs={new Set()}
        fpRegisters={fp}
        changedFpRegs={new Set(written < 0 ? [] : [written])}
        vectorRegisters={fp.map((bits) => `${bits}`)}
        sp="0x0000000080000000"
        pc={0x400000}
        nzcv={0}
        source={source}
        currentLine={line}
      />
    );
    const bits = [...FPRS];
    const { rerender } = render(step([...bits], -1, 1));
    bits[0] = "0x0000000000000001";
    rerender(step([...bits], 0, 2));
    expect(screen.getByText("5e-324")).toBeTruthy();
    bits[1] = "0x0000000040900000";
    rerender(step([...bits], 1, 3));
    // d0 keeps its double reading; s1 reads as the float the s write put there.
    expect(screen.getByText("5e-324")).toBeTruthy();
    expect(screen.getByText("4.5f")).toBeTruthy();
  });

  it("stays put when both files change in one step", () => {
    const { rerender } = renderLive(new Set(), new Set());
    rerender(
      <RegisterPanel
        registers={GPRS}
        changedRegs={new Set([0])}
        fpRegisters={FPRS}
        changedFpRegs={new Set([0])}
        sp="0x0000000080000000"
        pc={0x400000}
        nzcv={0}
      />,
    );
    expect(screen.getByText("X0")).toBeTruthy();
  });
});
