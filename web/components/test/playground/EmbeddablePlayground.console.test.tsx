import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Program output must reach the student through the real ConsolePanel, so
// only the editor and the register grid are stubbed. EmbeddablePlayground.test.tsx
// covers the controls; this file covers what the console shows.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    show: vi.fn(),
    info: vi.fn(),
  }),
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";

function engage(container: HTMLElement) {
  act(() => {
    fireEvent.mouseDown(container.firstChild as Element);
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("embed console rendering", () => {
  it("shows stdout as it grows, in place of the placeholder", () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const view = () => (
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />
    );
    const { container, rerender } = render(view());
    engage(container);
    expect(screen.getByText(/output prints here/i)).toBeTruthy();

    // Output arrives in pieces; each render must show everything printed so far.
    useEmulatorMock.mockReturnValue(makeHub({ stdout: "sum =" }));
    rerender(view());
    expect(screen.getByText("sum =")).toBeTruthy();
    expect(screen.queryByText(/output prints here/i)).toBeNull();

    useEmulatorMock.mockReturnValue(makeHub({ stdout: "sum = 10\n" }));
    rerender(view());
    expect(screen.getByText(/sum = 10/)).toBeTruthy();
  });

  it("shows stderr in the error colour beside stdout", () => {
    useEmulatorMock.mockReturnValue(
      makeHub({ stdout: "partial result\n", stderr: "error: bad input\n" }),
    );
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    expect(screen.getByText(/partial result/).className).not.toContain("--danger");
    const err = screen.getByText(/error: bad input/);
    expect(err.className).toContain("--danger");
  });

  it("shows a run fault as an alert in the embed control row", () => {
    // The full playground shows emu.error through Controls; the embed must not
    // let a faulting run stop silently (the pitfall demos depend on the
    // failure being visible).
    useEmulatorMock.mockReturnValue(
      makeHub({
        error:
          "memory fault: the program tried to read 0x0000000800600008, which no section covers. The base register (the first one inside the brackets, or a pointer passed to a call) does not hold an address, usually because `ldr xN, label` lost its `=` (it loads the value stored at the label) or a `mov` was written where `ldr xN, =label` was meant",
      }),
    );
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("memory fault");
  });

  it("shows no alert while the machine is error-free", () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the exit code in the embed console header", () => {
    useEmulatorMock.mockReturnValue(makeHub({ stdout: "done\n", exitCode: 3 }));
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    expect(screen.getByText("exit 3")).toBeTruthy();
  });

  it("sends stdin from the embed console to the hub, newline-terminated", () => {
    const hub = makeHub({ blocked: true });
    useEmulatorMock.mockReturnValue(hub);
    const { container } = render(
      <EmbeddablePlayground chrome="embed" startSource="mov x0, #1" />,
    );
    engage(container);
    const input = screen.getByLabelText("Standard input");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(hub.pushStdin).toHaveBeenCalledWith("42\n", true);
  });
});
