// Pins how the register list follows a write: it scrolls its own box (never
// the page) just far enough to show the written row, switches to the v view
// for a vector write, holds still for 5 s after the student scrolls, jumps
// instantly under reduced motion, stands down when "follow changes" is off,
// waits out a run, and says each write once through a polite status region.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegisterPanel } from "@/components/panels/RegisterPanel";

const ZERO_X = "0x0000000000000000";
const ZERO_V = "0x00000000000000000000000000000000";
const GPRS = Array.from({ length: 31 }, () => ZERO_X);
const FPRS = Array.from({ length: 32 }, () => ZERO_X);
const VECS = Array.from({ length: 32 }, () => ZERO_V);

// jsdom has no layout, so these tests supply one: the scroll box sits at
// y = 100 and is 100 px tall, and each row is a 20 px line in register
// order, so rows 0-4 show at scrollTop 0.
const BOX_TOP = 100;
const BOX_HEIGHT = 100;
const ROW = 20;

let scrollTop = 0;
let scrollCalls: ScrollToOptions[] = [];

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 300,
    width: 300,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  scrollTop = 0;
  scrollCalls = [];
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    if (this.getAttribute("role") === "region") return rect(BOX_TOP, BOX_HEIGHT);
    const grid = this.parentElement;
    if (grid?.parentElement?.getAttribute("role") === "region") {
      const line = Array.prototype.indexOf.call(grid.children, this);
      return rect(BOX_TOP + line * ROW - scrollTop, ROW);
    }
    return rect(0, 0);
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value(this: HTMLElement, options: ScrollToOptions) {
      scrollCalls.push(options);
      scrollTop = options.top ?? scrollTop;
    },
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
});

interface PanelProps {
  changedRegs?: Set<number>;
  changedFpRegs?: Set<number>;
  registers?: string[];
  vectorRegisters?: string[];
  running?: boolean;
}

function panel(props: PanelProps = {}) {
  return (
    <RegisterPanel
      registers={props.registers ?? GPRS}
      changedRegs={props.changedRegs ?? new Set()}
      fpRegisters={FPRS}
      changedFpRegs={props.changedFpRegs ?? new Set()}
      vectorRegisters={props.vectorRegisters ?? VECS}
      sp="0x0000fffffffff000"
      pc={0x400000}
      nzcv={0}
      running={props.running}
    />
  );
}

/** Mount, then give the scroll box its size: the region persists across
 *  re-renders while the rows remount on every write. */
function mount() {
  const view = render(panel());
  const box = screen.getByRole("region", { name: "register values" });
  Object.defineProperty(box, "scrollHeight", { configurable: true, value: 700 });
  Object.defineProperty(box, "clientHeight", { configurable: true, value: BOX_HEIGHT });
  Object.defineProperty(box, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
  });
  return { ...view, box };
}

function withRegister(index: number, hex: string): string[] {
  const next = [...GPRS];
  next[index] = hex;
  return next;
}

function status(): string {
  return (screen.getByRole("status").textContent ?? "").trim();
}

describe("RegisterPanel follows the write", () => {
  it("scrolls its own box just far enough to show a row below the fold", () => {
    const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([28]), registers: withRegister(28, "0x000000000000001c") }));
    // Row 28 spans 660-680; the box ends at 200, so it moves 480 px.
    expect(scrollCalls).toEqual([{ top: 480, behavior: "smooth" }]);
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it("leaves the list alone when the written row is already in view", () => {
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([2]) }));
    expect(scrollCalls).toEqual([]);
  });

  it("follows a write to sp, which sits after x30", () => {
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([31]) }));
    // SP is the 32nd row: 720-740 against a box ending at 200.
    expect(scrollCalls).toEqual([{ top: 540, behavior: "smooth" }]);
  });

  it("switches to the v view for a vector write and brings that row up", () => {
    const { rerender } = mount();
    // The student had scrolled down the x list.
    scrollTop = 400;
    const vecs = [...VECS];
    vecs[1] = "0x03030303030303030303030303030303";
    rerender(panel({ vectorRegisters: vecs, changedFpRegs: new Set([1]) }));
    expect(screen.getByText("v1 (q1)")).toBeTruthy();
    // v1 is the second line, 120-140 at scrollTop 0: it lands at the top.
    expect(scrollCalls).toEqual([{ top: 20, behavior: "smooth" }]);
    expect(status()).toBe("v1 = 2 lanes of 0303030303030303");
  });

  it("holds still for 5 s after the student scrolls the list", () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { rerender, box } = mount();
    fireEvent.wheel(box, { deltaY: -120 });
    now += 4_900;
    rerender(panel({ changedRegs: new Set([28]) }));
    expect(scrollCalls).toEqual([]);
    now += 200;
    rerender(panel({ changedRegs: new Set([27]) }));
    expect(scrollCalls).toEqual([{ top: 460, behavior: "smooth" }]);
  });

  it("does not take a zoom gesture for a scroll", () => {
    const { rerender, box } = mount();
    fireEvent.wheel(box, { deltaY: -120, ctrlKey: true });
    rerender(panel({ changedRegs: new Set([28]) }));
    expect(scrollCalls).toHaveLength(1);
  });

  it("jumps instantly under reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([28]) }));
    expect(scrollCalls).toEqual([{ top: 480, behavior: "auto" }]);
  });

  it("waits out a run, then follows the last write once", () => {
    const { rerender } = mount();
    // The run's last snapshot lands before the run reports it stopped.
    const last = new Set([28]);
    rerender(panel({ running: true, changedRegs: new Set([27]) }));
    rerender(panel({ running: true, changedRegs: last }));
    expect(scrollCalls).toEqual([]);
    expect(status()).toBe("");
    rerender(panel({ running: false, changedRegs: last }));
    expect(scrollCalls).toEqual([{ top: 480, behavior: "smooth" }]);
    expect(status()).toBe("x28 = 0x0");
  });

  it("says and moves nothing after a run whose last instruction wrote nothing", () => {
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([19]), registers: withRegister(19, "0x000000000000002f") }));
    expect(status()).toBe("x19 = 0x2f");
    scrollCalls = [];
    // Mid-run x27 held 0x35b5f; the run then restored it to 0 and ended on a
    // ret, so the snapshot it stopped on reports no write.
    rerender(
      panel({ running: true, changedRegs: new Set([27]), registers: withRegister(27, "0x0000000000035b5f") }),
    );
    const stopped = new Set<number>();
    rerender(panel({ running: true, changedRegs: stopped }));
    rerender(panel({ running: false, changedRegs: stopped }));
    expect(status()).toBe("");
    expect(scrollCalls).toEqual([]);
  });

  it("does not say the write from before a run again when the run stops", () => {
    const { rerender } = mount();
    // One snapshot is one set of objects; only `running` changes after it.
    const stepped = { changedRegs: new Set([28]), changedFpRegs: new Set<number>() };
    rerender(panel(stepped));
    expect(status()).toBe("x28 = 0x0");
    // Stopped (a reset, say) before its first snapshot landed.
    rerender(panel({ ...stepped, running: true }));
    rerender(panel({ ...stepped, running: false }));
    expect(status()).toBe("");
    expect(scrollCalls).toHaveLength(1);
  });

  it("takes a newly loaded program for no write, even over a call's leftovers", () => {
    const { rerender } = mount();
    // A run that ended just after a printf: x0 is the result, and every
    // caller-saved vector register holds the call's pattern.
    const leftovers = VECS.map((_, i) =>
      i >= 8 && i < 16
        ? "0xdeadbeefdeadbeef0000000000000000"
        : "0xdeadbeefdeadbeefdeadbeefdeadbeef",
    );
    rerender(
      panel({
        vectorRegisters: leftovers,
        changedRegs: new Set([0]),
        registers: withRegister(0, "0x0000000000000005"),
      }),
    );
    expect(status()).toBe("x0 = 0x5");
    // The student opens the v view, then assembles again: the machine comes
    // back zeroed and reports no write.
    fireEvent.click(screen.getByRole("button", { name: "v0–v31" }));
    scrollCalls = [];
    rerender(panel({ vectorRegisters: [...VECS] }));
    expect(status()).toBe("");
    expect(scrollCalls).toEqual([]);
    expect(screen.getByRole("button", { name: "v0–v31" }).getAttribute("aria-pressed")).toBe("true");
    const box = screen.getByRole("region", { name: "register values" });
    expect(box.querySelector(".anim-reg-flash")).toBeNull();
    expect(box.innerHTML).not.toContain("var(--changed)");
  });
});

describe("RegisterPanel follow changes switch", () => {
  it("is on by default, and off it keeps the list and the view where they are", () => {
    const { rerender } = mount();
    const toggle = screen.getByRole("checkbox", { name: "follow changes" }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(window.localStorage.getItem("aarch64-playground:regfile-follow")).toBe("0");

    rerender(panel({ changedRegs: new Set([28]) }));
    expect(scrollCalls).toEqual([]);
    const vecs = [...VECS];
    vecs[1] = "0x00000000000000010000000000000000";
    rerender(panel({ vectorRegisters: vecs }));
    // Still the x list; the v cell carries the change dot instead.
    expect(screen.getByText("X0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "v0–v31 changed" })).toBeTruthy();
  });

  it("remembers being switched off", () => {
    window.localStorage.setItem("aarch64-playground:regfile-follow", "0");
    mount();
    const toggle = screen.getByRole("checkbox", { name: "follow changes" }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  it("still works for the session when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { rerender } = mount();
    const toggle = screen.getByRole("checkbox", { name: "follow changes" }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    rerender(panel({ changedRegs: new Set([28]) }));
    expect(scrollCalls).toEqual([]);
  });
});

describe("RegisterPanel announces a write", () => {
  it("says the name and the new value, politely, in the list's format", () => {
    const { rerender } = mount();
    const region = screen.getByRole("status");
    // role=status is a polite live region.
    expect(region.getAttribute("role")).toBe("status");
    rerender(panel({ changedRegs: new Set([19]), registers: withRegister(19, "0x000000000000002f") }));
    expect(status()).toBe("x19 = 0x2f");
    fireEvent.click(screen.getByRole("button", { name: "dec" }));
    // A format click is not a write: nothing new is said.
    expect(status()).toBe("x19 = 0x2f");
    rerender(panel({ changedRegs: new Set([20]), registers: withRegister(20, "0xffffffffffffffe4") }));
    expect(status()).toBe("x20 = -28");
  });

  it("names three writes and counts the rest", () => {
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([0, 1, 2, 3, 4]) }));
    expect(status()).toBe("x0 = 0x0, x1 = 0x0, x2 = 0x0, and 2 more");
  });

  it("changes its text for a second identical write, so it is said again", () => {
    const { rerender } = mount();
    rerender(panel({ changedRegs: new Set([9]) }));
    const first = screen.getByRole("status").textContent;
    rerender(panel({ changedRegs: new Set([9]) }));
    const second = screen.getByRole("status").textContent;
    expect(first?.trim()).toBe("x9 = 0x0");
    expect(second?.trim()).toBe("x9 = 0x0");
    expect(second).not.toBe(first);
  });

  it("says nothing about what a library call leaves in the vector file", () => {
    const { rerender } = mount();
    const vecs = [...VECS];
    vecs[3] = "0xdeadbeefdeadbeefdeadbeefdeadbeef";
    rerender(
      panel({
        vectorRegisters: vecs,
        changedFpRegs: new Set([3]),
        changedRegs: new Set([0]),
        registers: withRegister(0, "0x000000000000000e"),
      }),
    );
    expect(status()).toBe("x0 = 0xe");
    expect(screen.getByText("X0")).toBeTruthy();
  });
});
