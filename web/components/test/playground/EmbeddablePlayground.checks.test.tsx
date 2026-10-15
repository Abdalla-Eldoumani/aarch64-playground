// pins how the checks reach the full playground: a share link's checks open
// the checks tab with them loaded, the handle hands the list back for the
// share dialog, every delivered program replaces the list with its own
// checks or none and clears the last run's report, a load from recents asks
// before it drops checks, and a run gets the working set's files.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import type { ReactNode } from "react";

vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/RegisterPanel", () => ({
  RegisterPanel: () => <div data-testid="registers" />,
}));
vi.mock("@/components/panels/ConsolePanel", () => ({
  ConsolePanel: () => <div data-testid="console" />,
}));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: () => <div data-testid="layout" />,
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div data-testid="pane-split">
      {first}
      {second}
    </div>
  ),
  EDITOR_SPLIT: { label: "resize editor and disassembly" },
  DEBUG_SPLIT: { label: "resize registers and tabs" },
}));

const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

const runner = vi.hoisted(() => ({ runChecks: vi.fn() }));
vi.mock("@/lib/playground/check-runner", () => runner);

import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
} from "@/components/playground/EmbeddablePlayground";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import type { ProgramCheck } from "@/lib/playground/program-checks";

// The tablet arrangement renders the right-hand tab strip directly.
function setWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
  window.dispatchEvent(new Event("resize"));
}

const SHARED: ProgramCheck[] = [{ name: "prints seven", stdin: "", args: "", stdout: "7\n" }];

function pickFirstRecent(): void {
  fireEvent.click(screen.getByRole("combobox", { name: "load recent program" }));
  const entry = screen.getAllByRole("option").find((option) => option.textContent !== "clear history");
  fireEvent.pointerDown(entry!);
}

// The full surface and the checks panel arrive through dynamic imports, and a
// first transform inside a test can outlast its one-second wait.
beforeAll(async () => {
  await import("@/components/playground/FullChromeSurface");
  await import("@/components/playground/ChecksPanel");
});

beforeEach(() => {
  useEmulatorMock.mockReturnValue(makeHub());
  setWidth(800);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setWidth(1024);
});

describe("checks in the full playground", () => {
  it("opens a share link on the checks tab with its checks loaded", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource="ret" startChecks={SHARED} fromShare />);
    const tab = await screen.findByRole("tab", { name: "checks" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText("prints seven")).toBeTruthy();
    expect(ref.current?.getChecks()).toEqual(SHARED);
  });

  it("opens on the memory tab when the link carries no checks", async () => {
    render(<EmbeddablePlayground chrome="full" startSource="ret" fromShare />);
    expect((await screen.findByRole("tab", { name: "memory" })).getAttribute("aria-selected")).toBe("true");
  });

  it("replaces the list on every delivery, and shows a delivery's own checks", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource="ret" startChecks={SHARED} />);
    await screen.findByRole("tab", { name: "memory" });
    // The last program's checks would only fail on this one.
    act(() => ref.current?.loadProgram({ source: "nop" }));
    expect(ref.current?.getChecks()).toEqual([]);
    const next: ProgramCheck[] = [{ name: "prints eight", stdin: "", args: "", stdout: "8\n" }];
    act(() => ref.current?.loadProgram({ source: "nop", checks: next, fromShare: true }));
    expect(ref.current?.getChecks()).toEqual(next);
    expect(screen.getByRole("tab", { name: "checks" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText("prints eight")).toBeTruthy();
  });

  it("runs the checks with the working set's files", async () => {
    runner.runChecks.mockResolvedValue({
      kind: "ran",
      outcomes: [
        {
          assembleError: null,
          error: null,
          errorLine: null,
          finished: true,
          stdout: "7\n",
          exitCode: 0,
          stackBalanced: true,
          frameIntact: true,
        },
      ],
    });
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource="ret" />);
    await screen.findByRole("tab", { name: "memory" });
    act(() =>
      ref.current?.loadProgram({ source: "nop", vfs: { "input.txt": "7\n" }, checks: SHARED, fromShare: true }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "run checks" }));
    await waitFor(() =>
      expect(runner.runChecks).toHaveBeenCalledWith({ main: "nop", extras: [] }, SHARED, { "input.txt": "7\n" }),
    );
  });

  it("drops the last run's report when another program is delivered", async () => {
    runner.runChecks.mockResolvedValue({ kind: "assemble-error", message: "main.asm line 1: unknown mnemonic" });
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource="ret" startChecks={SHARED} fromShare />);
    fireEvent.click(await screen.findByRole("button", { name: "run checks" }));
    expect(await screen.findByText("main.asm line 1: unknown mnemonic")).toBeTruthy();
    act(() => ref.current?.loadProgram({ source: "nop" }));
    expect(await screen.findByText("No checks yet.")).toBeTruthy();
    expect(screen.queryByText("main.asm line 1: unknown mnemonic")).toBeNull();
    expect(screen.queryByText("the program does not assemble, so no check ran")).toBeNull();
  });

  it("asks before a load from recents drops the checks, and keeps them on no", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource={"// first\nret\n"} />);
    await screen.findByRole("tab", { name: "memory" });
    // The first program goes to recents; the second arrives with checks and no edits.
    act(() => ref.current?.loadProgram({ source: "// second\nret\n", checks: SHARED }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      pickFirstRecent();
      expect(confirm).toHaveBeenCalledWith(
        "Load this program? It removes your check. Checks are not saved anywhere, so you cannot get them back.",
      );
      expect(ref.current?.getChecks()).toEqual(SHARED);
      confirm.mockReturnValue(true);
      pickFirstRecent();
      expect(ref.current?.getChecks()).toEqual([]);
      expect(ref.current?.getSource()).toBe("// first\nret\n");
    } finally {
      confirm.mockRestore();
    }
  });
});
