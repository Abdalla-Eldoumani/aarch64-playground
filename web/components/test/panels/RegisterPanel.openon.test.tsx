// Pins openOn: a host that knows which registers its program writes (the
// reference bench) opens the panel on that view, over the student's stored
// choice, and without storing its own.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { RegView } from "@/lib/emulator/emulator-state";
import { RegisterPanel } from "@/components/panels/RegisterPanel";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GPRS = Array.from({ length: 31 }, () => "0x0000000000000000");
const FPRS = Array.from({ length: 32 }, () => "0x0000000000000000");
const VECS = Array.from({ length: 32 }, () => "0x00000000000000000000000000000000");

function panel(openOn?: RegView) {
  return (
    <RegisterPanel
      openOn={openOn}
      registers={GPRS}
      changedRegs={new Set()}
      fpRegisters={FPRS}
      changedFpRegs={new Set()}
      vectorRegisters={VECS}
      sp="0x0000000080000000"
      pc={0x400000}
      nzcv={0}
    />
  );
}

const pressed = (name: string) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("RegisterPanel openOn", () => {
  it("opens on the named view over the stored one, and stores nothing", () => {
    window.localStorage.setItem("aarch64-playground:regfile-view", "x");
    render(panel("v"));
    expect(pressed("v0–v31")).toBe("true");
    expect(pressed("x0–x30")).toBe("false");
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("x");
  });

  it("opens on d for a floating-point program", () => {
    render(panel("d"));
    expect(pressed("d0–d31")).toBe("true");
  });

  it("falls back to the stored choice when the host names nothing", () => {
    window.localStorage.setItem("aarch64-playground:regfile-view", "d");
    render(panel());
    expect(pressed("d0–d31")).toBe("true");
  });
});
