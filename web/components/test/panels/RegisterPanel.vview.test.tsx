// Pins the third register view: the v cell only on a wasm that reports the
// 128-bit file, the lane-width control, and the auto-switch rule that tells a
// v write from a d write.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegisterPanel } from "@/components/panels/RegisterPanel";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GPRS = Array.from({ length: 31 }, () => "0x0000000000000000");
const FPRS = Array.from({ length: 32 }, () => "0x0000000000000000");
const ZERO_VEC = "0x00000000000000000000000000000000";
const VECS = Array.from({ length: 32 }, () => ZERO_VEC);

/** The vector file with one register replaced, so the panel sees it move. */
function vecsWith(bits: string, index = 0): string[] {
  const next = [...VECS];
  next[index] = bits;
  return next;
}

// The pc points at the NEXT instruction once a step lands, so every spelling
// fixture steps from line 1 to line 2 and the panel has to read line 1.
const INS_THEN_MOV = "        ins     v2.d[0], x1\n        mov     x9, sp\n";
const FMOV_THEN_MOVI = "        fmov    d0, x1\n        movi    v1.4s, 0x7f\n";

function panel(props: {
  vectorRegisters?: string[];
  changedRegs?: Set<number>;
  changedFpRegs?: Set<number>;
  source?: string;
  currentLine?: number | null;
}) {
  return (
    <RegisterPanel
      registers={GPRS}
      changedRegs={props.changedRegs ?? new Set()}
      fpRegisters={FPRS}
      changedFpRegs={props.changedFpRegs ?? new Set()}
      vectorRegisters={props.vectorRegisters ?? VECS}
      sp="0x0000000080000000"
      pc={0x400000}
      nzcv={0}
      source={props.source}
      currentLine={props.currentLine ?? null}
    />
  );
}

describe("RegisterPanel v-register view", () => {
  it("offers three cells only when the wasm reports the vector file", () => {
    const { rerender } = render(panel({ vectorRegisters: [] }));
    expect(screen.getByRole("button", { name: "x0–x30" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "d0–d31" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "v0–v31" })).toBeNull();
    rerender(panel({}));
    expect(screen.getByRole("button", { name: "v0–v31" })).toBeTruthy();
  });

  it("shows the whole file with both of each register's names", () => {
    render(panel({}));
    fireEvent.click(screen.getByRole("button", { name: "v0–v31" }));
    expect(screen.getByText("v0 (q0)")).toBeTruthy();
    expect(screen.getByText("v31 (q31)")).toBeTruthy();
    expect(screen.queryByText("X0")).toBeNull();
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("v");
  });

  it("re-slices the same bits under the persisted lane width", () => {
    render(panel({ vectorRegisters: vecsWith("0x0123456789abcdeffedcba9876543210") }));
    fireEvent.click(screen.getByRole("button", { name: "v0–v31" }));
    // Two 64-bit lanes by default.
    expect(screen.getByText("fedcba9876543210")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "s, 32-bit lanes" }));
    expect(screen.getByText("76543210")).toBeTruthy();
    expect(screen.queryByText("fedcba9876543210")).toBeNull();
    expect(window.localStorage.getItem("aarch64-playground:regfile-lane-width")).toBe("s");
  });

  it("persists the vector format toggle under its own key", () => {
    render(panel({}));
    fireEvent.click(screen.getByRole("button", { name: "v0–v31" }));
    const toggle = screen.getByRole("group", { name: "vector value format" });
    expect(toggle).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dec" }));
    expect(window.localStorage.getItem("aarch64-playground:regfile-v-dec")).toBe("1");
    // The d-view's key is untouched by the v-view's toggle.
    expect(window.localStorage.getItem("aarch64-playground:regfile-fp-hex")).toBeNull();
  });

  it("describes each view where the control can be read", () => {
    render(panel({}));
    const group = screen.getByRole("group", { name: "register view" });
    const help = document.getElementById(
      group.getAttribute("aria-describedby") as string,
    ) as HTMLElement;
    expect(help.textContent).toBe("x0–x30 are the integer registers.");
    fireEvent.click(screen.getByRole("button", { name: "v0–v31" }));
    expect(help.textContent).toBe(
      "v0–v31 are the full 128-bit vector registers, and q0–q31 is the same 128 bits named as a scalar.",
    );
  });
});

describe("RegisterPanel auto-switch across three views", () => {
  it("follows a write above bit 63 into the v-view", () => {
    const { rerender } = render(panel({}));
    expect(screen.getByText("X0")).toBeTruthy();
    rerender(
      panel({ vectorRegisters: vecsWith("0x00000000000000010000000000000000") }),
    );
    expect(screen.getByText("v0 (q0)")).toBeTruthy();
    expect(screen.queryByText("X0")).toBeNull();
  });

  it("keeps a write that stays under bit 64 in the d-view", () => {
    const { rerender } = render(panel({}));
    rerender(
      panel({
        vectorRegisters: vecsWith("0x0000000000000000400c000000000000"),
        changedFpRegs: new Set([0]),
      }),
    );
    expect(screen.getByText("D0")).toBeTruthy();
    expect(screen.queryByText("v0 (q0)")).toBeNull();
  });

  it("follows a v/q spelling even when nothing above bit 63 moved", () => {
    // ins v2.d[0], x1 executed; the pc has already moved on to the mov.
    const { rerender } = render(panel({ source: INS_THEN_MOV, currentLine: 1 }));
    rerender(
      panel({
        vectorRegisters: vecsWith("0x0000000000000000000000000000002a", 2),
        changedFpRegs: new Set([2]),
        source: INS_THEN_MOV,
        currentLine: 2,
      }),
    );
    expect(screen.getByText("v2 (q2)")).toBeTruthy();
  });

  it("reads the line that executed, not the one the pc moved to", () => {
    // fmov d0, x1 executed; the movi the pc now sits on has not run, and
    // reading it would send a plain fp write to the vector view.
    const { rerender } = render(panel({ source: FMOV_THEN_MOVI, currentLine: 1 }));
    rerender(
      panel({
        vectorRegisters: vecsWith("0x0000000000000000400c000000000000"),
        changedFpRegs: new Set([0]),
        source: FMOV_THEN_MOVI,
        currentLine: 2,
      }),
    );
    expect(screen.getByText("D0")).toBeTruthy();
    expect(screen.queryByText("v0 (q0)")).toBeNull();
  });

  it("reads a comment as no destination at all", () => {
    const source = "        // load v0 later\n        fmov    d0, x1\n";
    const { rerender } = render(panel({ source, currentLine: 1 }));
    rerender(
      panel({
        vectorRegisters: vecsWith("0x0000000000000000000000000000002a"),
        changedFpRegs: new Set([0]),
        source,
        currentLine: 2,
      }),
    );
    expect(screen.getByText("D0")).toBeTruthy();
  });

  it("marks the changed lanes rather than the whole register", () => {
    const { rerender } = render(panel({}));
    rerender(
      panel({ vectorRegisters: vecsWith("0x00000000000000010000000000000000") }),
    );
    // Lane 1 is the high half that moved; lane 0 is untouched.
    expect(screen.getAllByTitle("lane 1")[0].className).toContain("var(--amber)");
    expect(screen.getAllByTitle("lane 0")[0].className).not.toContain(
      "var(--amber)",
    );
  });

  it("keeps the view and dots the other cells when two classes write at once", () => {
    const { rerender } = render(panel({}));
    rerender(
      panel({
        changedRegs: new Set([0]),
        vectorRegisters: vecsWith("0x00000000000000010000000000000000"),
      }),
    );
    // The student was reading the x-file and stays there.
    expect(screen.getByText("X0")).toBeTruthy();
    const vCell = screen.getByRole("button", { name: "v0–v31 changed" });
    expect(vCell.innerHTML).toContain("var(--changed)");
    // Opening the flagged view clears its dot.
    fireEvent.click(vCell);
    expect(screen.getByRole("button", { name: "v0–v31" })).toBeTruthy();
  });

  it("follows an integer-only write back out of the v-view", () => {
    const { rerender } = render(panel({}));
    rerender(
      panel({ vectorRegisters: vecsWith("0x00000000000000010000000000000000") }),
    );
    expect(screen.getByText("v0 (q0)")).toBeTruthy();
    rerender(
      panel({
        vectorRegisters: vecsWith("0x00000000000000010000000000000000"),
        changedRegs: new Set([19]),
      }),
    );
    expect(screen.getByText("X19")).toBeTruthy();
    expect(screen.queryByText("v0 (q0)")).toBeNull();
  });
});
