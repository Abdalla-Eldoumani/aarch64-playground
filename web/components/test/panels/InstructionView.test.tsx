// pins the disassembly table: the pc row carries its marker and amber
// treatment, and a listing too large to hand the browser whole renders as a
// fixed window that follows the program counter instead of a quarter-million
// rows (the linker's 1 MiB .text window allows 262,144 instructions).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  INSTRUCTION_WINDOW,
  InstructionView,
} from "@/components/panels/InstructionView";
import type { DecodedInstruction } from "@/lib/emulator/use-emulator";

const CODE_BASE = 0x400000;

function listing(count: number): DecodedInstruction[] {
  return Array.from({ length: count }, (_, i) => ({
    address: CODE_BASE + i * 4,
    hex: "0xd503201f",
    text: `nop ${i}`,
  }));
}

function bodyRowCount(): number {
  return document.querySelectorAll("tbody tr").length;
}

afterEach(cleanup);

describe("InstructionView", () => {
  it("says so when nothing is assembled", () => {
    render(<InstructionView instructions={[]} pc={CODE_BASE} />);
    expect(screen.getByText("no program assembled")).toBeTruthy();
  });

  it("renders a small listing whole, with the pc row marked", () => {
    render(<InstructionView instructions={listing(3)} pc={CODE_BASE + 4} />);
    expect(bodyRowCount()).toBe(3);
    expect(screen.queryByRole("status")).toBeNull();
    const marked = Array.from(document.querySelectorAll("tbody tr")).filter((r) =>
      r.textContent?.startsWith("▶"),
    );
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain("nop 1");
  });

  it("windows a listing larger than the row budget and says what it is showing", () => {
    const total = INSTRUCTION_WINDOW * 4 + 10;
    render(<InstructionView instructions={listing(total)} pc={CODE_BASE} />);
    expect(bodyRowCount()).toBe(INSTRUCTION_WINDOW);
    const note = screen.getByRole("status");
    expect(note.textContent).toContain("1-512");
    expect(note.textContent).toContain(total.toLocaleString());
    // The first block starts at the top of the program.
    expect(screen.getByText("nop 0")).toBeTruthy();
    expect(screen.queryByText(`nop ${INSTRUCTION_WINDOW}`)).toBeNull();
  });

  it("moves the window to the block holding the program counter", () => {
    const total = INSTRUCTION_WINDOW * 4 + 10;
    // Index 1500 sits in the fourth block (1536 rows in, 512 wide).
    render(
      <InstructionView instructions={listing(total)} pc={CODE_BASE + 1500 * 4} />,
    );
    expect(bodyRowCount()).toBe(INSTRUCTION_WINDOW);
    expect(screen.getByText("nop 1500")).toBeTruthy();
    expect(screen.queryByText("nop 0")).toBeNull();
    const note = screen.getByRole("status");
    expect(note.textContent).toContain("1,025-1,536");
  });

  it("parks the window at the top when the pc is outside the listing", () => {
    const total = INSTRUCTION_WINDOW * 2;
    render(<InstructionView instructions={listing(total)} pc={0x7fff0000} />);
    expect(bodyRowCount()).toBe(INSTRUCTION_WINDOW);
    expect(screen.getByText("nop 0")).toBeTruthy();
  });

  it("marks and follows the anchor when the pc is off the listing", () => {
    const total = INSTRUCTION_WINDOW * 4 + 10;
    // Inside a libc call the pc is a trampoline word the listing does not
    // hold, so the marker and the window follow the call site instead of
    // parking at the top for all three steps.
    render(
      <InstructionView
        instructions={listing(total)}
        pc={0xffff0000}
        anchorPc={CODE_BASE + 1500 * 4}
      />,
    );
    const marked = Array.from(document.querySelectorAll("tbody tr")).filter((r) =>
      r.textContent?.startsWith("▶"),
    );
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain("nop 1500");
    expect(screen.getByRole("status").textContent).toContain("1,025-1,536");
    expect(screen.queryByText("nop 0")).toBeNull();
  });
});
