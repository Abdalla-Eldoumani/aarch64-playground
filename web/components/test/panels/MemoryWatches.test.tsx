// pins the memory-watch list: add a labeled address range and it renders
// a hex plus ascii strip read through getMemory, entries persist in
// localStorage across mounts, removal updates both list and store, and
// bad addresses or out-of-range lengths never create an entry.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryWatches } from "@/components/panels/MemoryWatches";

const STORE_KEY = "aarch64-playground:memory-watches";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// ascii-seeded bytes: 41 42 43 ... so the strip reads "ABC..."
function seededMemory() {
  return vi.fn((_addr: number, len: number) =>
    Uint8Array.from({ length: len }, (_, i) => (0x41 + i) & 0xff),
  );
}

function renderWatches() {
  const getMemory = seededMemory();
  const utils = render(<MemoryWatches getMemory={getMemory} />);
  return { getMemory, ...utils };
}

function addWatch(label: string, addr: string, length: string) {
  fireEvent.change(screen.getByLabelText("watch label"), { target: { value: label } });
  fireEvent.change(screen.getByLabelText("watch address"), { target: { value: addr } });
  fireEvent.change(screen.getByLabelText("watch byte length"), { target: { value: length } });
  fireEvent.click(screen.getByRole("button", { name: "add" }));
}

describe("MemoryWatches", () => {
  it("starts empty with the pin-an-address hint", () => {
    renderWatches();
    expect(screen.getByText("Pin an address; the bytes follow you across runs.")).toBeTruthy();
  });

  it("adds a watch and renders its hex and ascii rows from getMemory", () => {
    const { getMemory } = renderWatches();
    addWatch("buf", "0x00600000", "4");
    expect(getMemory).toHaveBeenCalledWith(0x00600000, 4);
    expect(screen.getByText("buf")).toBeTruthy();
    expect(screen.getByText("0x00600000 +4")).toBeTruthy();
    expect(screen.getByText("41 42 43 44")).toBeTruthy();
    expect(screen.getByText("ABCD")).toBeTruthy();
    // the hint clears once a watch exists
    expect(screen.queryByText("Pin an address; the bytes follow you across runs.")).toBeNull();
  });

  it("defaults the label to the parsed address when left blank", () => {
    renderWatches();
    addWatch("", "0x00600000", "4");
    expect(screen.getByText("0x600000")).toBeTruthy();
  });

  it("persists watches to localStorage and restores them on a fresh mount", () => {
    const { unmount } = renderWatches();
    addWatch("buf", "0x00600000", "4");
    expect(JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]")).toEqual([
      { label: "buf", addr: 0x00600000, length: 4 },
    ]);
    unmount();
    renderWatches();
    expect(screen.getByText("buf")).toBeTruthy();
    expect(screen.getByText("41 42 43 44")).toBeTruthy();
  });

  it("removes a watch and empties the store", () => {
    renderWatches();
    addWatch("buf", "0x00600000", "4");
    fireEvent.click(screen.getByRole("button", { name: "remove memory watch buf" }));
    expect(screen.queryByText("buf")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "null")).toEqual([]);
  });

  it("rejects an unparseable address", () => {
    renderWatches();
    addWatch("bad", "zz", "4");
    expect(screen.queryByText("bad")).toBeNull();
    expect(screen.getByText("Pin an address; the bytes follow you across runs.")).toBeTruthy();
  });

  it("rejects a length beyond the 512-byte cap", () => {
    renderWatches();
    addWatch("big", "0x00600000", "600");
    expect(screen.queryByText("big")).toBeNull();
  });
});
