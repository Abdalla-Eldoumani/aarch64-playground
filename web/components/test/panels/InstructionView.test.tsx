// pins the disassembly table: the pc row carries its marker, and a listing
// too large to hand the browser whole renders as a fixed window that follows
// the program counter instead of a quarter-million rows (the linker's 1 MiB
// .text window allows 262,144 instructions). The listing's own box follows
// the pc after each step, and is a keyboard stop that shows its focus.
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("shows one block of a listing too long to render whole, and says which rows", () => {
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

  it("marks and follows the call site when the pc is off the listing", () => {
    const total = INSTRUCTION_WINDOW * 4 + 10;
    // Inside a libc call the pc points at emulator code the listing does not
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

describe("InstructionView following the program counter", () => {
  // A 100px box over 20px rows: row i spans 20i to 20i + 20 in the content.
  const ROW = 20;
  let scrollTop = 0;
  afterEach(() => vi.restoreAllMocks());

  function mountBox(pc: number, running = false) {
    const view = render(
      <InstructionView instructions={listing(40)} pc={pc} running={running} />,
    );
    const box = screen.getByRole("group", { name: "disassembly" });
    scrollTop = 0;
    Object.defineProperty(box, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (next: number) => {
        scrollTop = next;
      },
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      if (this === box) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 100 });
      const index = Array.from(box.querySelectorAll("tbody tr")).indexOf(
        this as HTMLTableRowElement,
      );
      return DOMRect.fromRect({ x: 0, y: index * ROW - scrollTop, width: 300, height: ROW });
    });
    return view;
  }

  it("scrolls its own box just far enough to show the row after a step", () => {
    const { rerender } = mountBox(CODE_BASE);
    // Row 12 spans 240 to 260; the nearest scroll that shows it is 160.
    rerender(<InstructionView instructions={listing(40)} pc={CODE_BASE + 12 * 4} />);
    expect(scrollTop).toBe(160);
    // Row 10 (200 to 220, shown from 160) is in view, so nothing moves.
    rerender(<InstructionView instructions={listing(40)} pc={CODE_BASE + 10 * 4} />);
    expect(scrollTop).toBe(160);
    // Back above the view: the row lands at the top edge.
    rerender(<InstructionView instructions={listing(40)} pc={CODE_BASE + 2 * 4} />);
    expect(scrollTop).toBe(40);
  });

  it("holds still during a run and catches up when it stops", () => {
    const { rerender } = mountBox(CODE_BASE, true);
    rerender(
      <InstructionView instructions={listing(40)} pc={CODE_BASE + 30 * 4} running />,
    );
    expect(scrollTop).toBe(0);
    rerender(<InstructionView instructions={listing(40)} pc={CODE_BASE + 30 * 4} />);
    // Row 30 spans 600 to 620.
    expect(scrollTop).toBe(520);
  });

  it("is a named keyboard stop", () => {
    // Its focus outline is checked in the browser pass.
    render(<InstructionView instructions={listing(3)} pc={CODE_BASE} />);
    const box = screen.getByRole("group", { name: "disassembly" });
    expect(box.getAttribute("tabindex")).toBe("0");
  });
});
