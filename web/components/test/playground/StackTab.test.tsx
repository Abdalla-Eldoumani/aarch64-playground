// Pins the playground stack tab's two versions: it opens on the frames, the
// switch in its header shows the bytes, and the choice outlives the tab. The
// choice is one per viewer: every copy on the page and another tab follow it,
// even when storage throws.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StackTab } from "@/components/playground/StackTab";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const tab = () => render(<StackTab frames={<div data-testid="frames" />} bytes={<div data-testid="bytes" />} />);
const press = (name: string) =>
  fireEvent.click(within(screen.getByRole("group", { name: "frames or bytes" })).getByRole("button", { name }));

describe("StackTab", () => {
  it("opens on the frames", () => {
    tab();
    expect(screen.getByTestId("frames")).toBeTruthy();
    expect(screen.queryByTestId("bytes")).toBeNull();
  });

  it("switches to the bytes and back, keeping the choice for the next visit", () => {
    tab();
    press("bytes");
    expect(screen.getByTestId("bytes")).toBeTruthy();
    cleanup();
    tab();
    expect(screen.getByTestId("bytes")).toBeTruthy();
    press("frames");
    expect(screen.getByTestId("frames")).toBeTruthy();
    expect(window.localStorage.getItem("aarch64-playground:stack-bytes")).toBe("0");
  });

  function pair() {
    render(
      <>
        <StackTab frames={<div data-testid="frames-a" />} bytes={<div data-testid="bytes-a" />} />
        <StackTab frames={<div data-testid="frames-b" />} bytes={<div data-testid="bytes-b" />} />
      </>,
    );
    return screen.getAllByRole("group", { name: "frames or bytes" });
  }

  it("moves every copy on the page at once", () => {
    const [first] = pair();
    fireEvent.click(within(first).getByRole("button", { name: "bytes" }));
    expect(screen.getByTestId("bytes-a")).toBeTruthy();
    expect(screen.getByTestId("bytes-b")).toBeTruthy();
  });

  it("follows a change made in another tab", () => {
    tab();
    act(() => {
      window.localStorage.setItem("aarch64-playground:stack-bytes", "1");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "aarch64-playground:stack-bytes",
          newValue: "1",
          storageArea: window.localStorage,
        }),
      );
    });
    expect(screen.getByTestId("bytes")).toBeTruthy();
  });

  it("still moves every copy on the page when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const [first] = pair();
    fireEvent.click(within(first).getByRole("button", { name: "bytes" }));
    expect(screen.getByTestId("bytes-a")).toBeTruthy();
    expect(screen.getByTestId("bytes-b")).toBeTruthy();
  });
});
