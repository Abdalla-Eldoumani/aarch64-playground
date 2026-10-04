import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GlobalError from "./global-error";

// This page replaces the root layout, which is what failed, so it brings its
// own <html> and inline colors instead of globals.css. The tests check its
// text, the reset wiring, and the copied report, never a class name. jsdom
// accepts the nested <html> and <body> it renders.

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

function faulted(message: string, digest?: string): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string };
  if (digest) error.digest = digest;
  return error;
}

// The report is built once the markdown builder's code loads, so the copy
// button stays disabled briefly after mount. Every copy case waits for it.
// Loading the builder once up front keeps its first load, which took most
// of a second on a busy machine, out of that one-second wait.
beforeAll(async () => {
  await import("@/lib/playground/bundle-markdown");
});

async function reportReady() {
  await waitFor(() => {
    expect(
      screen
        .getByRole("button", { name: "copy error details" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
}

describe("global error page", () => {
  it("announces the fault in the same style as the 404", () => {
    render(<GlobalError error={faulted("boom")} reset={() => {}} />);
    expect(screen.getByText("runtime fault")).toBeTruthy();
    expect(screen.getByText("0x00000500")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Something broke");
    expect(screen.getByText(/hit an error before the page could load/)).toBeTruthy();
    expect(
      screen.getByText("brk #0 · execution stopped before this page finished"),
    ).toBeTruthy();
  });

  it("returns to the playground with a plain document load", () => {
    render(<GlobalError error={faulted("boom")} reset={() => {}} />);
    const link = screen.getByRole("link", { name: "return to playground" });
    expect(link.getAttribute("href")).toBe("/playground");
  });

  it("retries through the reset prop Next supplies", () => {
    const reset = vi.fn();
    render(<GlobalError error={faulted("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("copies a report carrying the error, its digest, and the autosaved program", async () => {
    window.localStorage.setItem("aarch64-playground:auto-save:current", "mov x1, 3\nret\n");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<GlobalError error={faulted("layout blew up", "def456")} reset={() => {}} />);
    await reportReady();
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const report = writeText.mock.calls[0][0] as string;
    expect(report).toContain("# Diagnostic bundle");
    expect(report).toContain("layout blew up");
    expect(report).toContain("digest def456");
    expect(report).toContain("mov x1, 3");
    expect(report).toContain("## Status\n\nthe page / stopped with the error below");
    expect(screen.getByRole("button", { name: "copied" })).toBeTruthy();
  });

  it("says so when the clipboard write is refused", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    render(<GlobalError error={faulted("boom")} reset={() => {}} />);
    await reportReady();
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "copy failed" })).toBeTruthy();
  });
});
