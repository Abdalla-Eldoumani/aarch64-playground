// Pins the register panel's stored choices: the view, each view's dec or hex,
// the lane width and "follow changes". Each is kept under its own key in the
// format a returning student's storage already holds and read back on the
// next visit. The dec/hex and follow flags are followed at once by every
// other panel on the page (a lesson holds several) and by a change made in
// another tab, and still by the page when storage throws (a private window,
// blocked site data). The view and the lane width are read when a panel
// mounts: a change, picked or made by a step, moves no panel already open.
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

/** Read when a panel mounts; a change moves only the panel it was made in. */
const MOUNT_READ: Setting[] = [
  {
    name: "the register view",
    key: "aarch64-playground:regfile-view",
    stored: "d",
    view: "x",
    change: (p) => openView(p, "d"),
    shows: (p) => pressed(viewCell(p, "d")),
  },
  {
    name: "the lane width",
    key: "aarch64-playground:regfile-lane-width",
    stored: "s",
    view: "v",
    change: (p) => fireEvent.click(cell(p, "lane arrangement", "s, 32-bit lanes")),
    shows: (p) => pressed(cell(p, "lane arrangement", "s, 32-bit lanes")),
  },
];

/** Followed at once by every open panel, on this page and in other tabs. */
const FOLLOWED: Setting[] = [
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
    name: "follow changes",
    key: "aarch64-playground:regfile-follow",
    stored: "0",
    view: "x",
    change: (p) => fireEvent.click(followBox(p)),
    shows: (p) => !followBox(p).checked,
  },
];

describe.each([...MOUNT_READ, ...FOLLOWED])("$name", (setting) => {
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
});

describe.each(MOUNT_READ)("$name, in an open panel", (setting) => {
  it("moves only the panel it was changed in", () => {
    const [a, b] = page();
    openView(a, setting.view);
    openView(b, setting.view);
    setting.change(a);
    expect(setting.shows(a)).toBe(true);
    expect(window.localStorage.getItem(setting.key)).toBe(setting.stored);
    expect(setting.shows(b)).toBe(false);
  });

  // Another tab's pick or step reaches this one as the browser's storage
  // event; the landing hero walks with "follow changes" on and stores x.
  it("stays as it was when another tab changes it, and a panel opened later reads it", () => {
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
    expect(setting.shows(a)).toBe(false);
    render(panel("later"));
    expect(setting.shows(screen.getByTestId("later"))).toBe(true);
  });

  it("holds in its own panel only when storage throws", () => {
    blockStorage();
    const [a, b] = page();
    openView(a, setting.view);
    openView(b, setting.view);
    setting.change(a);
    expect(setting.shows(a)).toBe(true);
    expect(setting.shows(b)).toBe(false);
  });
});

describe.each(FOLLOWED)("$name, in every open panel", (setting) => {
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
  // "follow changes" switches a panel to the file a step wrote and stores that
  // view for the next visit; a lesson's other frames stay on theirs.
  it("stores the view a write switches one panel to and leaves the others on theirs", () => {
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
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("d");
    expect(pressed(viewCell(screen.getByTestId("b"), "x"))).toBe(true);
  });
});

describe("the register view, when a panel mounts on a step already followed", () => {
  // Showing the registers again (the registers or stack switch, a phone's
  // registers tab) mounts a new panel on the last step's snapshot. That write
  // was followed when it arrived; with "follow changes" off the new panel must
  // not store its file over the student's choice, here or in any other panel.
  it("leaves the stored view and the other panels alone", () => {
    window.localStorage.setItem("aarch64-playground:regfile-view", "d");
    window.localStorage.setItem("aarch64-playground:regfile-follow", "0");
    const { rerender } = render(<>{panel("a")}</>);
    rerender(
      <>
        {panel("a")}
        <RegisterPanel
          registers={GPRS}
          changedRegs={new Set([0])}
          fpRegisters={FPRS}
          changedFpRegs={new Set()}
          vectorRegisters={VECS}
          sp="0x0000000080000000"
          pc={0x400000}
          nzcv={0}
        />
      </>,
    );
    expect(pressed(viewCell(screen.getByTestId("a"), "d"))).toBe(true);
    expect(window.localStorage.getItem("aarch64-playground:regfile-view")).toBe("d");
  });
});
