import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import GlobalError from "./global-error";

// The root-layout error boundary. It renders its own document (the Next
// contract) with inline literal colors, because the layout that installs
// globals.css and the fonts is the thing that failed -- so the assertions here
// pin the register text, the reset wiring, and the copy report rather than any
// class name. jsdom accepts the nested <html>/<body> React renders.

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

describe("global error page", () => {
  it("announces the fault in the same register as the 404", () => {
    render(<GlobalError error={faulted("boom")} reset={() => {}} />);
    expect(screen.getByText("runtime fault")).toBeTruthy();
    expect(screen.getByText("0x00000500")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("something broke");
    expect(screen.getByText(/hit an error before the page could load/)).toBeTruthy();
    expect(
      screen.getByText("brk #0 -- execution stopped before this page finished"),
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
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const report = writeText.mock.calls[0][0] as string;
    expect(report).toContain("# diagnostic bundle");
    expect(report).toContain("layout blew up");
    expect(report).toContain("digest def456");
    expect(report).toContain("mov x1, 3");
    expect(report).toContain("**route:**");
    expect(screen.getByRole("button", { name: "copied" })).toBeTruthy();
  });

  it("says so when the clipboard write is refused", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    render(<GlobalError error={faulted("boom")} reset={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "copy failed" })).toBeTruthy();
  });
});
