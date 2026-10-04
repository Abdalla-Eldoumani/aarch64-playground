import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegisterPanel } from "@/components/panels/RegisterPanel";

const registers = Array.from(
  { length: 31 },
  (_, i) => `0x${i.toString(16).padStart(16, "0")}`,
);

function renderPanel() {
  return render(
    <RegisterPanel
      registers={registers}
      changedRegs={new Set()}
      sp="0x0000fffffffff000"
      pc={0x400000}
      nzcv={0}
    />,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("RegisterPanel", () => {
  it("labels itself with an h2 by default and at the level a host asks for", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "regfile", level: 2 })).toBeTruthy();
    cleanup();
    render(
      <RegisterPanel
        registers={registers}
        changedRegs={new Set()}
        sp="0x0000fffffffff000"
        pc={0x400000}
        nzcv={0}
        headingLevel={3}
      />,
    );
    expect(screen.getByRole("heading", { name: "regfile", level: 3 })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("renders all 31 general registers plus SP and PC with full values", () => {
    renderPanel();
    expect(screen.getByText("X0")).toBeTruthy();
    expect(screen.getByText("X30")).toBeTruthy();
    expect(screen.getByText("SP")).toBeTruthy();
    expect(screen.getByText("PC")).toBeTruthy();
    // Values render whole, never elided: the low digits carry the meaning.
    expect(screen.getByText("0x0000000000000000")).toBeTruthy();
    expect(screen.getByText("0x000000000000001e")).toBeTruthy();
    expect(screen.getByText("0x0000fffffffff000")).toBeTruthy();
  });

  it("reads the 64-bit extremes in decimal: the unsigned value only under a negative", () => {
    const extremes = [...registers];
    extremes[0] = "0xffffffffffffffff"; // -1
    extremes[1] = "0x8000000000000000"; // INT64_MIN, whose negation does not fit
    extremes[2] = "0x7fffffffffffffff"; // INT64_MAX: one reading
    render(
      <RegisterPanel registers={extremes} changedRegs={new Set()} sp="0x0" pc={0x400000} nzcv={0} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "dec" }));
    const row = (name: string) => screen.getByText(name).parentElement!.textContent ?? "";
    expect(row("X0")).toContain("-1");
    expect(row("X0")).toContain("18446744073709551615u");
    expect(row("X1")).toContain("-9223372036854775808");
    expect(row("X1")).toContain("9223372036854775808u");
    expect(row("X2")).toContain("9223372036854775807");
    expect(row("X2")).not.toMatch(/-|u/);
  });

  it("says what a library call left when x0 to x18 hold its marker", () => {
    const note = /0xdeadbeefdeadbeef\s*is what a library call left: a call may change x0 to x18 and the flags\./;
    const panel = (regs: string[]) => (
      <RegisterPanel registers={regs} changedRegs={new Set()} sp="0x0000fffffffff000" pc={0x400000} nzcv={0b1101} />
    );
    const { rerender, container } = render(panel(registers));
    expect(container.textContent).not.toMatch(note);

    const afterCall = registers.map((hex, i) => (i >= 1 && i <= 18 ? "0xdeadbeefdeadbeef" : hex));
    rerender(panel(afterCall));
    expect(container.textContent).toMatch(note);

    // Only x19 to x30 holding it is the program's own doing, not a call's.
    const kept = registers.map((hex, i) => (i === 19 ? "0xDEADBEEFDEADBEEF" : hex));
    rerender(panel(kept));
    expect(container.textContent).not.toMatch(note);
  });

  it("shows each register's alias (arg0, fp, lr) beside its name", () => {
    renderPanel();
    expect(screen.getByText("arg0")).toBeTruthy();
    expect(screen.getByText("fp")).toBeTruthy();
    expect(screen.getByText("lr")).toBeTruthy();
  });
  it("labels each NZCV flag with its own bit, in N Z C V order", () => {
    // nzcv packs N at bit 3, Z bit 2, C bit 1, V bit 0. 0b1010 = N set,
    // Z clear, C set, V clear. A set flag renders bold-amber, an unset one
    // recedes to the tertiary token, so each label must sit over its own bit.
    render(
      <RegisterPanel
        registers={registers}
        changedRegs={new Set()}
        sp="0x0000fffffffff000"
        pc={0x400000}
        nzcv={0b1010}
      />,
    );
    const cls = (name: string) => screen.getByText(name).className;
    expect(cls("N")).toContain("amber");
    expect(cls("C")).toContain("amber");
    expect(cls("Z")).toContain("tertiary");
    expect(cls("V")).toContain("tertiary");
  });

  it("states set and clear in text, so colour is not the only cue", () => {
    render(
      <RegisterPanel
        registers={registers}
        changedRegs={new Set()}
        sp="0x0000fffffffff000"
        pc={0x400000}
        nzcv={0b1010}
      />,
    );
    // The bit value rides visibly beside the letter and the word reaches a
    // screen reader: bold amber alone says nothing to a reader who cannot
    // separate it from the tertiary grey.
    const flag = (name: string) =>
      (screen.getByText(name).parentElement as HTMLElement).textContent;
    expect(flag("N")).toBe("N=1 set");
    expect(flag("C")).toBe("C=1 set");
    expect(flag("Z")).toBe("Z=0 clear");
    expect(flag("V")).toBe("V=0 clear");
  });
});
