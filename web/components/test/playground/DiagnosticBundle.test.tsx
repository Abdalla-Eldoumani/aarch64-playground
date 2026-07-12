import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticBundle } from "@/components/playground/DiagnosticBundle";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DiagnosticBundle", () => {
  it("renders the default label", () => {
    render(<DiagnosticBundle build={() => ({ source: "ret\n" })} />);
    expect(screen.getByRole("button", { name: /copy diagnostic bundle/i }).textContent).toBe(
      "diagnostic bundle",
    );
  });

  it("writes a markdown bundle to the clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<DiagnosticBundle build={() => ({ source: ".text\nret\n", exitCode: 0 })} />);
    const btn = screen.getByRole("button", { name: /copy diagnostic bundle/i });
    fireEvent.click(btn);
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const md = writeText.mock.calls[0][0] as string;
    expect(md).toContain("# diagnostic bundle");
    expect(md).toContain("ret");
    expect(md).toContain("**exit code:** 0");
  });

  it("flips the label to 'copy failed' when the clipboard write rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    render(<DiagnosticBundle build={() => ({ source: "ret\n" })} />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button").textContent).toBe("copy failed");
  });
});
