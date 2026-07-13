import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StackAlignment } from "@/components/diagrams/StackAlignment";

const THEMES = ["dark", "light", "high-contrast"] as const;

const STP = "stp x29, x30, [sp, -16]!";
const SUB24 = "sub sp, sp, 24";
const SUB32 = "sub sp, sp, 32";
const MISALIGNED_NOTE = "misaligned — a bl from here faults on real hardware";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("StackAlignment", () => {
  it("starts aligned at 0x7fffff00 with sp resting on the caller's edge", () => {
    render(<StackAlignment />);
    expect(screen.getByText("sp = 0x7fffff00")).toBeTruthy();
    expect(screen.getByText("sp % 16 = 0")).toBeTruthy();
    expect(screen.getByText("aligned")).toBeTruthy();
    expect(screen.queryByText(MISALIGNED_NOTE)).toBeNull();
    // before any move the amber marker sits on the caller's-frame band
    expect(
      screen.getByLabelText("caller's frame, sp rests at its bottom edge"),
    ).toBeTruthy();
    expect(screen.getByText("<- sp")).toBeTruthy();
  });

  it("the stp pair preset drops sp 16 bytes and stays aligned", () => {
    render(<StackAlignment />);
    fireEvent.click(screen.getByRole("button", { name: STP }));
    // 0x7fffff00 - 16, worked out by hand
    expect(screen.getByText("sp = 0x7ffffef0")).toBeTruthy();
    expect(screen.getByText("aligned")).toBeTruthy();
    // the marker followed sp onto the newly taken cell
    const cell = screen.getByLabelText("0x7ffffef0, inside the new frame");
    expect(cell.textContent).toContain("<- sp");
  });

  it("sub sp, sp, 24 lands on an odd multiple of 8 and flips the verdict", () => {
    render(<StackAlignment />);
    fireEvent.click(screen.getByRole("button", { name: SUB24 }));
    // 0x7fffff00 - 24, worked out by hand
    expect(screen.getByText("sp = 0x7ffffee8")).toBeTruthy();
    expect(screen.getByText("sp % 16 = 8")).toBeTruthy();
    expect(screen.getByText(MISALIGNED_NOTE)).toBeTruthy();
    expect(screen.queryByText("aligned")).toBeNull();
  });

  it("sub sp, sp, 32 keeps the boundary", () => {
    render(<StackAlignment />);
    fireEvent.click(screen.getByRole("button", { name: SUB32 }));
    // 0x7fffff00 - 32, worked out by hand
    expect(screen.getByText("sp = 0x7ffffee0")).toBeTruthy();
    expect(screen.getByText("aligned")).toBeTruthy();
    expect(screen.queryByText(MISALIGNED_NOTE)).toBeNull();
  });

  it("compounds moves and the verdict follows every step", () => {
    render(<StackAlignment />);
    fireEvent.click(screen.getByRole("button", { name: STP }));
    fireEvent.click(screen.getByRole("button", { name: SUB24 }));
    // 0x7fffff00 - 16 - 24, worked out by hand
    expect(screen.getByText("sp = 0x7ffffed8")).toBeTruthy();
    expect(screen.getByText(MISALIGNED_NOTE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SUB24 }));
    // 0x7fffff00 - 16 - 24 - 24: two odd drops land back on the boundary
    expect(screen.getByText("sp = 0x7ffffec0")).toBeTruthy();
    expect(screen.getByText("aligned")).toBeTruthy();
  });

  it("reset returns sp to the start and disables itself there", () => {
    render(<StackAlignment />);
    const reset = screen.getByRole("button", { name: "reset" });
    expect(reset.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: SUB24 }));
    expect(reset.hasAttribute("disabled")).toBe(false);
    fireEvent.click(reset);
    expect(screen.getByText("sp = 0x7fffff00")).toBeTruthy();
    expect(screen.getByText("aligned")).toBeTruthy();
    expect(reset.hasAttribute("disabled")).toBe(true);
  });

  it("disables any preset that would walk off the rendered cells", () => {
    render(<StackAlignment />);
    const stp = screen.getByRole("button", { name: STP });
    for (let i = 0; i < 6; i++) fireEvent.click(stp);
    // 0x7fffff00 - 96: the lowest rendered cell
    expect(screen.getByText("sp = 0x7ffffea0")).toBeTruthy();
    expect(stp.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByRole("button", { name: SUB24 }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: SUB32 }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("announces sp and the verdict from an aria-live region", () => {
    render(<StackAlignment />);
    const live = screen.getByText("aligned").closest("[aria-live='polite']");
    expect(live).not.toBeNull();
    expect(live?.textContent).toContain("sp = 0x7fffff00");
  });

  it("marks sp in amber and tints the verdict from tokens, never color alone", () => {
    const { container } = render(<StackAlignment />);
    expect(container.innerHTML).toContain("var(--amber)");
    expect(container.innerHTML).toContain("var(--success)");
    fireEvent.click(screen.getByRole("button", { name: SUB24 }));
    expect(container.innerHTML).toContain("var(--danger)");
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<StackAlignment />);
      expect(screen.getByLabelText("stack alignment")).toBeTruthy();
      unmount();
    }
  });
});
