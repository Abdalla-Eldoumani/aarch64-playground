import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import LZString from "lz-string";
import { DiagnosticBundle } from "@/components/playground/DiagnosticBundle";
import type { DiagnosticBundle as BundleData } from "@/lib/playground/diagnostic-bundle";

afterEach(() => {
  cleanup();
  document.cookie = "sid=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

const bundle: BundleData = { source: ".text\nret\n", exitCode: 0, status: "finished after 1 step with exit code 0" };

function useClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
}

async function openDialog(build: () => Promise<BundleData> = async () => bundle) {
  const view = render(<DiagnosticBundle build={build} />);
  // Pressed from the keyboard, the way focus return matters most.
  const opener = screen.getByRole("button", { name: "diagnostic bundle" });
  opener.focus();
  fireEvent.click(opener);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

const report = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "diagnostic report" });

describe("DiagnosticBundle", () => {
  it("opens a dialog that shows the whole report before anything is copied", async () => {
    const writeText = useClipboard();
    await openDialog();
    expect(screen.getByRole("dialog", { name: "Diagnostic bundle" })).toBeTruthy();
    expect(report().value).toContain("# Diagnostic bundle");
    expect(report().value).toContain("finished after 1 step with exit code 0");
    expect(report().value).toContain("## What I got");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("gathers the snapshot once per opening, not once per render", async () => {
    const build = vi.fn(async () => bundle);
    const view = await openDialog(build);
    view.rerender(<DiagnosticBundle build={vi.fn(async () => bundle)} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("copies the report, then the link, each on its own button", async () => {
    const writeText = useClipboard();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "copy report" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenLastCalledWith(report().value);
    expect(screen.getByRole("status").textContent).toContain("report copied");

    fireEvent.click(screen.getByRole("button", { name: "copy link" }));
    await act(async () => {
      await Promise.resolve();
    });
    const link = writeText.mock.lastCall?.[0] as string;
    expect(link.startsWith(`${window.location.origin}/?bundle=`)).toBe(true);
    expect(report().value).toContain(`[open in the playground](${link})`);
    expect(screen.getByRole("status").textContent).toBe("link copied.");
  });

  it("tells the student to copy by hand when the clipboard refuses", async () => {
    useClipboard(vi.fn().mockRejectedValue(new Error("blocked")));
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "copy report" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("status").textContent).toContain("copy it by hand");
  });

  it("says so when the machine could not be read", async () => {
    await openDialog(async () => {
      throw new Error("worker gone");
    });
    expect(screen.getByRole("alert").textContent).toContain("could not be read");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "copy report" }).disabled).toBe(true);
  });

  it("offers no link for a program too large for one", async () => {
    let seed = 1;
    const noise = Array.from({ length: 3000 }, () => {
      seed = (seed * 48271) % 2147483647;
      return seed.toString(36);
    }).join("\n");
    useClipboard();
    await openDialog(async () => ({ source: noise }));
    expect(screen.queryByRole("button", { name: "copy link" })).toBeNull();
    expect(screen.getByText(/too large for a link/)).toBeTruthy();
  });

  it("stays open when a double press's second click lands on the backdrop", async () => {
    let now = 1000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      await openDialog();
      const dialog = screen.getByRole("dialog", { name: "Diagnostic bundle" });
      // A mouse's second click, then a touch screen's second tap (detail 1,
      // but inside the double-press interval).
      fireEvent.click(dialog, { detail: 2 });
      now += 200;
      fireEvent.click(dialog, { detail: 1 });
      expect(screen.getByRole("dialog", { name: "Diagnostic bundle" })).toBeTruthy();
      // A single click on the backdrop later still closes it.
      now += 600;
      fireEvent.click(dialog, { detail: 1 });
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });

  it("closes on Escape and hands focus back to the button", async () => {
    await openDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "diagnostic bundle" }));
  });

  it("carries no cookie, stored value, or address-bar query into the report or the link", async () => {
    document.cookie = "sid=COOKIE-SECRET";
    window.localStorage.setItem("gh-token", "TOKEN-SECRET");
    window.localStorage.setItem("aarch64-playground:auto-save:current", "STORED-SECRET");
    window.history.replaceState(null, "", "/playground?token=QUERY-SECRET#p2=HASH-SECRET");
    const writeText = useClipboard();
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "copy link" }));
    await act(async () => {
      await Promise.resolve();
    });
    const link = writeText.mock.lastCall?.[0] as string;
    expect(link.startsWith(`${window.location.origin}/playground?bundle=`)).toBe(true);
    const payload = LZString.decompressFromEncodedURIComponent(link.split("?bundle=")[1]);
    for (const secret of ["COOKIE-SECRET", "TOKEN-SECRET", "STORED-SECRET", "QUERY-SECRET", "HASH-SECRET"]) {
      expect(report().value, secret).not.toContain(secret);
      expect(link, secret).not.toContain(secret);
      expect(payload, secret).not.toContain(secret);
    }
  });
});
