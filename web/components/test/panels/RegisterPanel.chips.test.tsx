// The register panel's pointer chips, from real machine states of the node
// build: a chip on each register that points into a frame, naming the slot
// and whose frame it is, gone once the register leaves the stack; none on
// x29, none while a run goes, none where the host cannot show the stack;
// and hover, focus and a press each reaching the host. The names are worked
// out by hand from the programs (the slot lookup's own suite holds the edges).
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RegisterPanel } from "@/components/panels/RegisterPanel";
import { PointerContext, type SlotPointer } from "@/components/panels/slot-pointer";
import { nodeMachine } from "@/components/test/playground/helpers/node-machine";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** A node machine, and what the hub would hand the panel on it. */
function machine(file: string, stdin?: string) {
  const m = nodeMachine(file, stdin);
  return { ...m, props: () => ({ ...m.state(), changedRegs: new Set<number>(), nzcv: 0 }) };
}

const host = (point: SlotPointer["point"]) =>
  function Host({ children }: { children: ReactNode }) {
    return <PointerContext.Provider value={{ pointed: null, point }}>{children}</PointerContext.Provider>;
  };

const chipsShown = () => screen.queryAllByRole("button", { name: / points to / });
/** The row of register `name` ("X1"). */
const row = (name: string) => screen.getByText(name, { selector: "span" }).parentElement!;

describe("pointer chips", () => {
  // locals.s at `bl scanf`: x1 = fp + 16 (a_s) and x2 = fp + 20 (b_s); x29
  // points at main's saved fp. Past the scanf the library call leaves its
  // marker in x1 and x2.
  it("names a_s and b_s on x1 and x2 at locals.s's scanf, and drops them once the call has run", async () => {
    const m = machine("public/examples/cpsc355/locals.s", "7 4\n");
    m.runTo("bl      scanf");
    const { rerender } = render(<RegisterPanel {...m.props()} />, { wrapper: host(vi.fn()) });
    const x1 = await screen.findByRole("button", { name: "x1 points to a_s in main's frame. Show it in the stack." });
    expect(x1.textContent).toBe("a_s · main");
    expect(within(row("X1")).getByRole("button")).toBe(x1);
    expect(within(row("X2")).getByRole("button").textContent).toBe("b_s · main");
    expect(chipsShown()).toHaveLength(2);
    expect(within(row("X29")).queryByRole("button")).toBeNull();
    const valueBefore = row("X1").lastElementChild!.className;

    m.runTo("ldr     a_r, [fp, a_s]");
    rerender(<RegisterPanel {...m.props()} />);
    expect(chipsShown()).toHaveLength(0);
    // The alias comes back, and the value keeps the place and box it had
    // beside the chip (the browser gate measures the pixels).
    expect(row("X1").textContent).toContain("arg1");
    expect(row("X1").lastElementChild!.className).toBe(valueBefore);
    m.emu.free();
  });

  // fill-squares.s entering square's second call: x0 = fill's fp + 28
  // (sq_s), x9 still the dest pointer fill moved past arr[0], main's
  // arr_s[1] (square's mul is about to reuse w9). After the fourth store
  // the pointer sits at main's frame top, past every frame.
  it("names a caller's slot from two calls down, follows the pointer and lets it go past the frame", async () => {
    const m = machine("lib/test/emulator/fixtures/fill-squares.s");
    m.runTo("mul     w9, w1, w1", 2);
    const { rerender } = render(<RegisterPanel {...m.props()} />, { wrapper: host(vi.fn()) });
    expect((await screen.findByRole("button", { name: /^x0 / })).textContent).toBe("sq_s · fill");
    expect(within(row("X9")).getByRole("button").textContent).toBe("arr_s[1] · main");

    m.runTo("str     x9, [fp, dest_s]");
    rerender(<RegisterPanel {...m.props()} />);
    expect(within(row("X9")).getByRole("button").textContent).toBe("arr_s[2] · main");

    m.runTo("str     x9, [fp, dest_s]", 2);
    rerender(<RegisterPanel {...m.props()} />);
    expect(within(row("X9")).queryByRole("button")).toBeNull();
    m.emu.free();
  });

  it("tells the host when a chip is under the mouse or focus, left, and pressed", async () => {
    const point = vi.fn();
    const m = machine("public/examples/cpsc355/locals.s", "7 4\n");
    m.runTo("bl      scanf");
    render(<RegisterPanel {...m.props()} />, { wrapper: host(point) });
    const x2 = await screen.findByRole("button", { name: /^x2 / });
    fireEvent.mouseEnter(x2);
    fireEvent.mouseLeave(x2);
    fireEvent.focus(x2);
    fireEvent.blur(x2);
    fireEvent.click(x2);
    expect(point.mock.calls).toEqual([[2], [null], [2], [null], [2, true]]);
    m.emu.free();
  });

  it("shows none where the host cannot show the stack, and none while a run goes", async () => {
    const m = machine("public/examples/cpsc355/locals.s", "7 4\n");
    m.runTo("bl      scanf");
    render(<RegisterPanel {...m.props()} />);
    await act(async () => {
      await import("@/components/panels/PointerChips");
    });
    expect(chipsShown()).toHaveLength(0);
    cleanup();

    const { rerender } = render(<RegisterPanel {...m.props()} running />, { wrapper: host(vi.fn()) });
    await act(async () => {
      await import("@/components/panels/PointerChips");
    });
    expect(chipsShown()).toHaveLength(0);
    rerender(<RegisterPanel {...m.props()} />);
    expect(await screen.findAllByRole("button", { name: / points to / })).toHaveLength(2);
    m.emu.free();
  });
});
