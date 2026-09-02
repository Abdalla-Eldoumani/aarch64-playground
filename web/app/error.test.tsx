import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ErrorPage from "./error";

// Pins the route error boundary: the fault-card register, the retry prop, and
// the copied markdown report.

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

// The report is built when the markdown builder's chunk lands, so the copy
// button is inert for a beat after mount. Every copy case waits for it.
async function reportReady() {
  await waitFor(() => {
    expect(
      screen
        .getByRole("button", { name: "copy error details" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
}

describe("route error page", () => {
  it("announces the fault in the 404's register", () => {
    render(<ErrorPage error={faulted("boom")} reset={() => {}} />);
    expect(screen.getByText("runtime fault")).toBeTruthy();
    expect(screen.getByText("0x00000500")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("something broke");
    expect(screen.getByText(/hit an error while rendering this page/)).toBeTruthy();
    expect(
      screen.getByText("brk #0 · execution stopped before this page finished"),
    ).toBeTruthy();
  });

  it("supplies the route's main landmark for the skip link", () => {
    render(<ErrorPage error={faulted("boom")} reset={() => {}} />);
    const main = screen.getByRole("main");
    expect(main.getAttribute("id")).toBe("main");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("offers the way back to the playground", () => {
    render(<ErrorPage error={faulted("boom")} reset={() => {}} />);
    const link = screen.getByRole("link", { name: "return to playground" });
    expect(link.getAttribute("href")).toBe("/playground");
  });

  it("retries through the reset prop Next supplies", () => {
    const reset = vi.fn();
    render(<ErrorPage error={faulted("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("copies a report carrying the error, its digest, and the autosaved program", async () => {
    window.localStorage.setItem("aarch64-playground:auto-save:current", "mov x0, 7\nret\n");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <ErrorPage error={faulted("cannot read x of undefined", "abc123")} reset={() => {}} />,
    );
    await reportReady();
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const report = writeText.mock.calls[0][0] as string;
    expect(report).toContain("# diagnostic bundle");
    expect(report).toContain("cannot read x of undefined");
    expect(report).toContain("digest abc123");
    expect(report).toContain("mov x0, 7");
    expect(report).toContain("**route:**");
    expect(screen.getByRole("button", { name: "copied" })).toBeTruthy();
  });

  it("reports the error alone when no autosave is readable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<ErrorPage error={faulted("boom")} reset={() => {}} />);
    await reportReady();
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("**last error:** boom");
  });

  it("says so when the clipboard write is refused", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    render(<ErrorPage error={faulted("boom")} reset={() => {}} />);
    await reportReady();
    fireEvent.click(screen.getByRole("button", { name: "copy error details" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "copy failed" })).toBeTruthy();
  });
});
