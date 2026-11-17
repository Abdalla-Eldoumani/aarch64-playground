// Pins the register panel's stored choices: the view, each view's dec or hex,
// the lane width and "follow changes". Each is kept under its own key in the
// format a returning student's storage already holds, read back on the next
// visit, followed at once by every other panel on the page (a lesson holds
// several) and by a change made in another tab, and still followed by the
// page when storage throws (a private window, blocked site data).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { RegView } from "@/lib/emulator/emulator-state";
import { RegisterPanel } from "@/components/panels/RegisterPanel";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const GPRS = Array.from({ length: 31 }, () => "0x0000000000000000");
const FPRS = Array.from({ length: 32 }, () => "0x0000000000000000");
const VECS = Array.from({ length: 32 }, () => "0x00000000000000000000000000000000");

function panel(name: string, changedFpRegs = new Set<number>()) {
  return (
    <div data-testid={name}>
      <RegisterPanel
        registers={GPRS}
        changedRegs={new Set()}
        fpRegisters={FPRS}
        changedFpRegs={changedFpRegs}
        vectorRegisters={VECS}
        sp="0x0000000080000000"
        pc={0x400000}
        nzcv={0}
      />
    </div>
  );
}

function page(): [HTMLElement, HTMLElement] {
  render(
    <>
      {panel("a")}
      {panel("b")}
    </>,
  );
  return [screen.getByTestId("a"), screen.getByTestId("b")];
}

const VIEW_CELLS: Record<RegView, string> = { x: "x0–x30", d: "d0–d31", v: "v0–v31" };
const viewCell = (p: HTMLElement, view: RegView) => within(p).getByRole("button", { name: VIEW_CELLS[view] });
const openView = (p: HTMLElement, view: RegView) => fireEvent.click(viewCell(p, view));
const pressed = (cell: HTMLElement) => cell.getAttribute("aria-pressed") === "true";
const cell = (p: HTMLElement, group: string, name: string) =>
  within(within(p).getByRole("group", { name: group })).getByRole("button", { name });
const followBox = (p: HTMLElement) =>
  within(p).getByRole("checkbox", { name: "follow changes" }) as HTMLInputElement;

function blockStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
}

interface Setting {
  name: string;
  key: string;
  /** The stored text after the change, as earlier versions wrote it. */
  stored: string;
  /** The view whose header holds the control. */
  view: RegView;
  change: (p: HTMLElement) => void;
  shows: (p: HTMLElement) => boolean;
}

const SETTINGS: Setting[] = [
  {
    name: "the register view",
    key: "aarch64-playground:regfile-view",
    stored: "d",
    view: "x",
    change: (p) => openView(p, "d"),
    shows: (p) => pressed(viewCell(p, "d")),
  },
  {
    name: "the x view's dec or hex",
    key: "aarch64-playground:regfile-x-dec",
    stored: "1",
    view: "x",
    change: (p) => fireEvent.click(cell(p, "integer value format", "dec")),
    shows: (p) => pressed(cell(p, "integer value format", "dec")),
  },
  {
    name: "the d view's dec or hex",
    key: "aarch64-playground:regfile-fp-hex",
    stored: "1",
    view: "d",
    change: (p) => fireEvent.click(cell(p, "fp value format", "hex")),
    shows: (p) => pressed(cell(p, "fp value format", "hex")),
  },
  {
    name: "the v view's dec or hex",
    key: "aarch64-playground:regfile-v-dec",
    stored: "1",
    view: "v",
    change: (p) => fireEvent.click(cell(p, "vector value format", "dec")),
    shows: (p) => pressed(cell(p, "vector value format", "dec")),
  },
  {
    name: "the lane width",
    key: "aarch64-playground:regfile-lane-width",
    stored: "s",
    view: "v",
    change: (p) => fireEvent.click(cell(p, "lane arrangement", "s, 32-bit lanes")),
    shows: (p) => pressed(cell(p, "lane arrangement", "s, 32-bit lanes")),
  },
  {
    name: "follow changes",
    key: "aarch64-playground:regfile-follow",
    stored: "0",
    view: "x",
    change: (p) => fireEvent.click(followBox(p)),
    shows: (p) => !followBox(p).checked,
  },
];

describe.each(SETTINGS)("$name", (setting) => {
  it("is kept under its own key, in the stored format", () => {
    const [a] = page();
    openView(a, setting.view);
    setting.change(a);
    expect(window.localStorage.getItem(setting.key)).toBe(setting.stored);
  });

  it("is read back on the next visit", () => {
    window.localStorage.setItem("aarch64-playground:regfile-view", setting.view);
    window.localStorage.setItem(setting.key, setting.stored);
    const [a] = page();
    expect(setting.shows(a)).toBe(true);
  });

  it("moves every panel on the page at once", () => {
    const [a, b] = page();
    openView(a, setting.view);
    openView(b, setting.view);
    setting.change(a);
    expect(setting.shows(a)).toBe(true);
    expect(setting.shows(b)).toBe(true);
  });

  it("follows a change made in another tab", () => {
    const [a] = page();
    openView(a, setting.view);
    act(() => {
      window.localStorage.setItem(setting.key, setting.stored);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: setting.key,
          newValue: setting.stored,
          storageArea: window.localStorage,
        }),
      );
    });
    expect(setting.shows(a)).toBe(true);
  });

  it("still moves every panel on the page when storage throws", () => {
    blockStorage();
    const [a, b] = page();
    openView(a, setting.view);
    openView(b, setting.view);
    setting.change(a);
    expect(setting.shows(a)).toBe(true);
    expect(setting.shows(b)).toBe(true);
  });
});

describe("the register view, moved by a step", () => {
  // "follow changes" switches a panel to the file a step wrote; that switch is
  // the stored view, so the other panels on the page take it too.
  it("moves every panel on the page when a write switches one", () => {
    const { rerender } = render(
      <>
        {panel("a")}
        {panel("b")}
      </>,
    );
    rerender(
      <>
        {panel("a", new Set([0]))}
        {panel("b")}
      </>,
    );
    expect(pressed(viewCell(screen.getByTestId("a"), "d"))).toBe(true);
    expect(pressed(viewCell(screen.getByTestId("b"), "d"))).toBe(true);
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("d");
  });
});
