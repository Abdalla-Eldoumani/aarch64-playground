import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConsolePanel } from "./ConsolePanel";
import { MAX_STDIN_BYTES } from "@/lib/upload-guard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const pushStdin = vi.fn();
  const uploadVfsFile = vi.fn();
  const clearConsole = vi.fn();
  render(
    <ConsolePanel
      stdout=""
      stderr=""
      blocked={false}
      exitCode={null}
      vfsFiles={[]}
      pushStdin={pushStdin}
      uploadVfsFile={uploadVfsFile}
      clearConsole={clearConsole}
    />,
  );
  const input = screen.getByLabelText("Standard input") as HTMLInputElement;
  return { pushStdin, uploadVfsFile, clearConsole, input };
}

describe("ConsolePanel stdin validation", () => {
  it("forwards an in-bounds stdin line with a trailing newline", () => {
    const { pushStdin, input } = setup();
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.submit(input.closest("form")!);
    expect(pushStdin).toHaveBeenCalledWith("42\n");
    expect(input.value).toBe("");
  });

  it("rejects an over-cap stdin submission without reaching the emulator", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pushStdin, input } = setup();
    fireEvent.change(input, { target: { value: "x".repeat(MAX_STDIN_BYTES + 1) } });
    fireEvent.submit(input.closest("form")!);
    expect(pushStdin).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
