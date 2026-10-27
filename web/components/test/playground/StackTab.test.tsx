// Pins the playground stack tab's two versions: it opens on the frames, the
// switch in its header shows the bytes, and the choice outlives the tab.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StackTab } from "@/components/playground/StackTab";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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
});
