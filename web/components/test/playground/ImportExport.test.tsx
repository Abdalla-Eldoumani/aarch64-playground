import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

import { ImportExport } from "@/components/playground/ImportExport";
import {
  MAX_SOURCE_BYTES,
  MAX_WORKSPACE_FILES,
  checkUploadSize,
  validateSource,
} from "@/lib/playground/upload-guard";
import type { ImportTarget } from "@/lib/hooks/use-import-target";

const TARGET: ImportTarget = { kind: "main" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

beforeEach(() => {
  toastError.mockClear();
});

function setup(source = "mov x0, 1\nsvc 0\n") {
  const onImport = vi.fn();
  const onImportMany = vi.fn();
  const { container } = render(
    <ImportExport
      source={source}
      onImport={onImport}
      onImportMany={onImportMany}
      target={TARGET}
    />,
  );
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onImport, onImportMany, fileInput };
}

describe("ImportExport import path", () => {
  it("routes a valid imported file body to the active target", async () => {
    const { onImport, fileInput } = setup();
    const body = "mov x0, 7\nsvc 0\n";
    const file = new File([body], "main.s", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport).toHaveBeenCalledWith(TARGET, body);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hands a multi-select pick to onImportMany with names and bodies", async () => {
    const { onImport, onImportMany, fileInput } = setup();
    const a = new File(["main body\n"], "main.asm", { type: "text/plain" });
    const b = new File(["helper body\n"], "helpers.asm", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [a, b] } });

    await waitFor(() => expect(onImportMany).toHaveBeenCalledTimes(1));
    expect(onImportMany).toHaveBeenCalledWith([
      { name: "main.asm", body: "main body\n" },
      { name: "helpers.asm", body: "helper body\n" },
    ]);
    expect(onImport).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("rejects an over-cap file by size with the guard message and never imports", () => {
    const { onImport, fileInput } = setup();
    const oversized = new File(["x".repeat(MAX_SOURCE_BYTES + 1)], "big.s");

    fireEvent.change(fileInput, { target: { files: [oversized] } });

    // The size guard runs synchronously off file.size, before the body is
    // read; the toast names the offending file for multi-select imports.
    const expected = checkUploadSize(MAX_SOURCE_BYTES + 1, MAX_SOURCE_BYTES, "source file");
    expect(toastError).toHaveBeenCalledWith(`big.s: ${expected}`);
    expect(onImport).not.toHaveBeenCalled();
  });

  it("rejects over-cap decoded content with the guard message and a console warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { onImport, fileInput } = setup();

    // A file whose fast pre-read size passes the first guard but whose decoded
    // text exceeds the byte cap, exercising the content-validator branch.
    const file = new File(["small"], "sneaky.s");
    Object.defineProperty(file, "size", { value: 16, configurable: true });
    const huge = "x".repeat(MAX_SOURCE_BYTES + 1);
    file.text = () => Promise.resolve(huge);

    fireEvent.change(fileInput, { target: { files: [file] } });

    const expected = validateSource(huge);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(`sneaky.s: ${expected}`),
    );
    expect(onImport).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("ignores a change event with no file selected", () => {
    const { onImport, fileInput } = setup();
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(onImport).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("opens the file picker when the import button is clicked", () => {
    const { fileInput } = setup();
    const click = vi.spyOn(fileInput, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "import assembly file" }));
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe("ImportExport export path", () => {
  it("copies the source to the clipboard and flips the label to 'copied'", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    setup("ldr x0, [sp]\n");
    const button = screen.getByRole("button", { name: "copy source to clipboard" });
    expect(button.textContent).toBe("copy");

    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("ldr x0, [sp]\n");
    // The aria-label is stable, so the same button is found after the flip.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "copy source to clipboard" }).textContent).toBe(
        "copied",
      ),
    );
  });

  it("downloads the source as .asm and .s files via object URLs", () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    // Capture the synthesized anchors instead of letting jsdom attempt a real
    // navigation on click.
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    setup("ret\n");
    fireEvent.click(screen.getByRole("combobox", { name: "export the program" }));
    fireEvent.pointerDown(screen.getByRole("option", { name: ".asm" }));
    fireEvent.click(screen.getByRole("combobox", { name: "export the program" }));
    fireEvent.pointerDown(screen.getByRole("option", { name: ".s" }));

    expect(downloads).toEqual(["program.asm", "program.s"]);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});

describe("ImportExport workspace bundle", () => {
  // The share link is the only other carrier for a multi-file program, and
  // it dies well before a real one fits in a URL fragment; before this the
  // export buttons all closed over the main buffer alone.
  const FILES = [
    { name: "util.s", body: "// util\n" },
    { name: "sort.s", body: "// sort\n" },
  ];

  function setupWorkspace(source = "mov x0, 1\n") {
    const onImport = vi.fn();
    const onImportMany = vi.fn();
    const { container } = render(
      <ImportExport
        source={source}
        files={FILES}
        onImport={onImport}
        onImportMany={onImportMany}
        target={TARGET}
      />,
    );
    return {
      onImport,
      onImportMany,
      fileInput: container.querySelector('input[type="file"]') as HTMLInputElement,
    };
  }

  function captureDownload(): { blobs: Blob[]; names: string[] } {
    const blobs: Blob[] = [];
    const names: string[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        blobs.push(blob);
        return "blob:mock";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return { blobs, names };
  }

  it("downloads main.asm and every helper as one workspace.json", async () => {
    const captured = captureDownload();
    setupWorkspace("mov x0, 1\n");

    fireEvent.click(screen.getByRole("combobox", { name: "export the program" }));
    fireEvent.pointerDown(screen.getByRole("option", { name: "workspace .json" }));

    expect(captured.names).toEqual(["workspace.json"]);
    const text = await captured.blobs[0].text();
    expect(JSON.parse(text)).toEqual({
      version: 1,
      files: [
        { name: "main.asm", body: "mov x0, 1\n" },
        { name: "util.s", body: "// util\n" },
        { name: "sort.s", body: "// sort\n" },
      ],
    });
  });

  it("reads a bundle back through the multi-file import path", async () => {
    const { onImportMany, fileInput } = setupWorkspace();
    const bundle = JSON.stringify({
      version: 1,
      files: [
        { name: "main.asm", body: "mov x0, 2\n" },
        { name: "queue.s", body: "// queue\n" },
      ],
    });
    fireEvent.change(fileInput, {
      target: { files: [new File([bundle], "workspace.json", { type: "application/json" })] },
    });

    await waitFor(() => expect(onImportMany).toHaveBeenCalledTimes(1));
    expect(onImportMany).toHaveBeenCalledWith([
      { name: "main.asm", body: "mov x0, 2\n" },
      { name: "queue.s", body: "// queue\n" },
    ]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("refuses a malformed bundle without touching the workspace", async () => {
    const { onImport, onImportMany, fileInput } = setupWorkspace();
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File([JSON.stringify({ version: 1, files: [{ name: 7 }] })], "bad.json"),
        ],
      },
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "that workspace bundle has a malformed file",
      ),
    );
    expect(onImportMany).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("refuses a bundle carrying more files than a workspace can hold", async () => {
    const { onImportMany, fileInput } = setupWorkspace();
    const files = Array.from({ length: MAX_WORKSPACE_FILES + 1 }, (_, i) => ({
      name: `f${i}.s`,
      body: "ret\n",
    }));
    fireEvent.change(fileInput, {
      target: { files: [new File([JSON.stringify({ version: 1, files })], "huge.json")] },
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        `that workspace bundle has too many files (max ${MAX_WORKSPACE_FILES})`,
      ),
    );
    expect(onImportMany).not.toHaveBeenCalled();
  });

  it("refuses json that is not a bundle at all", async () => {
    const { onImportMany, fileInput } = setupWorkspace();
    fireEvent.change(fileInput, {
      target: { files: [new File(['{"hello":"world"}'], "notes.json")] },
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("that .json file is not a workspace bundle"),
    );
    expect(onImportMany).not.toHaveBeenCalled();
  });
});
