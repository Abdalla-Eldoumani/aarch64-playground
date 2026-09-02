import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CallingConventionGuide } from "@/components/reference/CallingConventionGuide";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("CallingConventionGuide", () => {
  it("renders the register diagram and the interactive frame walk", () => {
    render(<CallingConventionGuide />);
    expect(screen.getByLabelText("aapcs64 register file")).toBeTruthy();
    expect(screen.getByLabelText("frame walk")).toBeTruthy();
    expect(screen.getByRole("button", { name: "next" })).toBeTruthy();
  });

  it("heads the four sections with the numbered kickers, in order", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    const headings = [
      "01 · registers by role: integer",
      "02 · registers by role: floating point",
      "03 · the frame record",
      "04 · 16-byte stack alignment",
    ];
    let last = -1;
    for (const heading of headings) {
      const at = text.indexOf(heading);
      expect(at, heading).toBeGreaterThan(last);
      last = at;
    }
  });

  it("teaches the floating-point register file under section 02 in s/d terms", () => {
    const { container } = render(<CallingConventionGuide />);
    const strip = screen.getByLabelText("aapcs64 floating-point register file");
    for (const reg of ["d0", "d8", "d16", "d31"]) {
      expect(within(strip).getAllByText(reg).length).toBeGreaterThanOrEqual(1);
    }
    // The s view sits on every cell, and fcvt bridges the two widths.
    expect(within(strip).getAllByText("s8").length).toBeGreaterThanOrEqual(1);
    const text = container.textContent ?? "";
    expect(text).toContain("s0");
    expect(text).toContain("fcvt");
    expect(text).toContain("no floating-point frame pointer");
    // The course never teaches vector registers; the guide must not either.
    expect(text).not.toContain("vector");
  });

  it("teaches the w view of the integer registers under section 01", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    expect(text).toContain("low 32 bits");
    expect(text).toContain("w19");
  });

  it("mounts the stack alignment probe with its presets under section 04", () => {
    render(<CallingConventionGuide />);
    expect(screen.getByLabelText("stack alignment")).toBeTruthy();
    expect(screen.getByRole("button", { name: "sub sp, sp, 24" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "stp x29, x30, [sp, -16]!" }),
    ).toBeTruthy();
  });

  it("teaches the course frame shape: locals above fp at positive offsets", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    expect(text).toContain("[fp, 16]");
    expect(text).not.toContain("[fp, -16]");
  });

  it("renders the register-role split and the alignment guidance", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    expect(text).toContain("callee-saved");
    expect(text).toContain("16-byte");
    expect(text).toContain("x19");
    // a phrase only the authored prose carries, in neither diagram
    expect(text).toContain("indirect result address");
  });

  it("routes every prose block through the single LessonMarkdown path", () => {
    render(<CallingConventionGuide />);
    // Hover-define summaries and inline-code tokens only appear when the real
    // LessonMarkdown rendered the authored markdown; a stub would flatten the
    // back-ticked tokens to plain text. One distinctive artifact per block:
    // the lead and the alignment prose write `printf` as inline code, the
    // integer prose resolves x8, the floating-point prose resolves x29, the
    // frame prose resolves stp, and the alloc + alignment prose resolve sp.
    expect(
      screen.getAllByText("printf", { selector: "code" }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByLabelText(/indirect-result register \(x8\)/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText(/frame pointer \(x29 \/ fp\)/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText(/store pair; mirrors ldp/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText(/stack pointer \(sp\)/i).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("attaches the shared register roles to the inline tokens", () => {
    render(<CallingConventionGuide />);
    // x19 written as inline code resolves to the callee-saved role summary, the
    // same classification the hover cards and the register-file diagram use.
    expect(
      screen.getAllByLabelText(/callee-saved register \(x19-x28\)/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows the course prologue and epilogue", () => {
    const { container } = render(<CallingConventionGuide />);
    const text = container.textContent ?? "";
    expect(text).toContain("[sp, alloc]!"); // pre-indexed save opens the frame
    expect(text).toContain("[sp], dealloc"); // post-indexed restore closes it
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<CallingConventionGuide />);
      expect(screen.getByLabelText("aapcs64 calling convention")).toBeTruthy();
      unmount();
    }
  });
});
