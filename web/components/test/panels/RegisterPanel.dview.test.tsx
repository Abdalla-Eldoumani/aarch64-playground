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
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("1");
  });

  it("offers the dec/hex toggle only inside the d-view", () => {
    renderPanel();
    expect(screen.queryByRole("group", { name: "fp value format" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "d0–d31" }));
    const toggle = screen.getByRole("group", { name: "fp value format" });
    expect(toggle).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "hex" }));
    expect(window.localStorage.getItem("aarch64-playground:regfile-fp-hex")).toBe("1");
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
