import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ConsolePanel } from "@/components/panels/ConsolePanel";
import { MAX_STDIN_BYTES, MAX_VFS_BYTES, checkUploadSize } from "@/lib/playground/upload-guard";

// Mock the toast hook so the guard's exact message can be asserted directly,
// without depending on react-hot-toast's async DOM rendering.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    error: toastError,
    success: vi.fn(),
    show: vi.fn(),
    info: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  toastError.mockClear();
});

function setup(overrides: Partial<ComponentProps<typeof ConsolePanel>> = {}) {
  const pushStdin = vi.fn();
  const closeStdin = vi.fn();
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
      closeStdin={closeStdin}
      uploadVfsFile={uploadVfsFile}
      clearConsole={clearConsole}
      {...overrides}
    />,
  );
  const input = screen.getByLabelText("Standard input") as HTMLInputElement;
  return { pushStdin, closeStdin, uploadVfsFile, clearConsole, input };
}

describe("ConsolePanel stdin validation", () => {
  it("forwards an in-bounds stdin line with a trailing newline, marked interactive", () => {
    const { pushStdin, input } = setup();
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.submit(input.closest("form")!);
    // Typed at a prompt, so the machine echoes it into the transcript --
    // a redirect would go through the same call without the flag.
    expect(pushStdin).toHaveBeenCalledWith("42\n", true);
    expect(input.value).toBe("");
  });

  it("ctrl-d on an empty line signals end of input", () => {
    const { closeStdin, pushStdin, input } = setup();
    fireEvent.keyDown(input, { key: "d", ctrlKey: true });
    expect(closeStdin).toHaveBeenCalledTimes(1);
    expect(pushStdin).not.toHaveBeenCalled();
    // With text pending, ctrl-d must not eat the line.
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.keyDown(input, { key: "d", ctrlKey: true });
    expect(closeStdin).toHaveBeenCalledTimes(1);
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

describe("ConsolePanel vfs upload", () => {
  function uploadInput() {
    return screen.getByLabelText("Upload file to virtual filesystem") as HTMLInputElement;
  }

  it("registers an uploaded file into the vfs with its bytes", async () => {
    const { uploadVfsFile } = setup();
    const file = new File([new Uint8Array([1, 2, 3, 4])], "data.bin");

    fireEvent.change(uploadInput(), { target: { files: [file] } });

    await waitFor(() => expect(uploadVfsFile).toHaveBeenCalledTimes(1));
    const [name, bytes] = uploadVfsFile.mock.calls[0];
    expect(name).toBe("data.bin");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes as Uint8Array)).toEqual([1, 2, 3, 4]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("rejects an over-cap upload with the guard message and never touches the vfs", () => {
    const { uploadVfsFile } = setup();
    const big = new File(["x"], "huge.bin");
    // The size guard runs synchronously off file.size, before the bytes are read.
    Object.defineProperty(big, "size", { value: MAX_VFS_BYTES + 1, configurable: true });

    fireEvent.change(uploadInput(), { target: { files: [big] } });

    expect(toastError).toHaveBeenCalledWith(
      checkUploadSize(MAX_VFS_BYTES + 1, MAX_VFS_BYTES, "file"),
    );
    expect(uploadVfsFile).not.toHaveBeenCalled();
  });

  it("ignores a change event with no file selected", () => {
    const { uploadVfsFile } = setup();
    fireEvent.change(uploadInput(), { target: { files: [] } });
    expect(uploadVfsFile).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("ConsolePanel controls and state", () => {
  it("invokes clearConsole when the clear button is pressed", () => {
    const { clearConsole } = setup();
    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    expect(clearConsole).toHaveBeenCalledTimes(1);
  });

  it("surfaces the waiting-for-input status and placeholder when blocked", () => {
    const { input } = setup({ blocked: true });
    expect(screen.getByRole("status").textContent).toBe("waiting for input");
    expect(input.placeholder).toBe(
      "program is waiting for input... (ctrl-d = end of input)",
    );
  });

  it("shows a zero exit code (the != null edge, not falsiness)", () => {
    setup({ exitCode: 0 });
    expect(screen.getByText("exit 0")).toBeTruthy();
  });

  it("shows the idle hint with no output and the stream once it arrives", () => {
    const { rerender } = render(
      <ConsolePanel
        stdout=""
        stderr=""
        blocked={false}
        exitCode={null}
        vfsFiles={[]}
        pushStdin={vi.fn()}
        closeStdin={vi.fn()}
        uploadVfsFile={vi.fn()}
        clearConsole={vi.fn()}
      />,
    );
    expect(screen.getByText("Output prints here as your program runs.")).toBeTruthy();

    rerender(
      <ConsolePanel
        stdout="hello\n"
        stderr=""
        blocked={false}
        exitCode={null}
        vfsFiles={[]}
        pushStdin={vi.fn()}
        closeStdin={vi.fn()}
        uploadVfsFile={vi.fn()}
        clearConsole={vi.fn()}
      />,
    );
    expect(screen.getByText(/hello/)).toBeTruthy();
    expect(screen.queryByText("Output prints here as your program runs.")).toBeNull();
  });

  it("lists registered vfs files", () => {
    setup({ vfsFiles: ["a.bin", "b.txt"] });
    expect(screen.getByText(/vfs: a\.bin, b\.txt/)).toBeTruthy();
  });
});

describe("ConsolePanel when a terminal session owns the program", () => {
  it("disables its stdin box and points at the terminal tab", () => {
    const { pushStdin, input } = setup({ ownedByTerminal: true, blocked: true });
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toMatch(/terminal tab/);
    // Even a forced submit cannot smuggle input past the disabled box.
    fireEvent.submit(input.closest("form")!);
    expect(pushStdin).not.toHaveBeenCalled();
  });

  it("replaces the waiting-for-input badge with a running note", () => {
    setup({ ownedByTerminal: true, blocked: true });
    expect(screen.getByText("running in the terminal")).toBeTruthy();
    expect(screen.queryByText("waiting for input")).toBeNull();
  });

  it("keeps the normal blocked badge when no session owns the program", () => {
    setup({ blocked: true });
    expect(screen.getByText("waiting for input")).toBeTruthy();
    expect(screen.queryByText("running in the terminal")).toBeNull();
  });
});

describe("ConsolePanel output a terminal session produced", () => {
  const NOTE = "this run happened in the terminal tab";

  it("renders nothing but the note when the session owned the whole run", () => {
    setup({ stdout: "[2J[H drawn frame", terminalOwnedFrom: 0 });
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(screen.queryByText(/drawn frame/)).toBeNull();
    // The idle hint would be a second, contradictory explanation.
    expect(screen.queryByText("Output prints here as your program runs.")).toBeNull();
  });

  it("keeps what printed before the takeover and drops the rest", () => {
    setup({
      stdout: "menu ready\n[2J[H drawn frame",
      terminalOwnedFrom: 11,
    });
    expect(screen.getByText(/menu ready/)).toBeTruthy();
    expect(screen.queryByText(/drawn frame/)).toBeNull();
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it("still shows the exit code the run ended with", () => {
    setup({ stdout: "[2J frame", terminalOwnedFrom: 0, exitCode: 0 });
    expect(screen.getByText("exit 0")).toBeTruthy();
  });

  it("leaves stderr whole -- the pane never showed it", () => {
    setup({
      stdout: "[2J frame",
      stderr: "warning: no such file\n",
      terminalOwnedFrom: 0,
    });
    expect(screen.getByText(/warning: no such file/)).toBeTruthy();
  });

  it("renders a classic run byte for byte with no watermark", () => {
    setup({ stdout: "sum = 10\n", stderr: "" });
    expect(screen.getByText(/sum = 10/)).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
