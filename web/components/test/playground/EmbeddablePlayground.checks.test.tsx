// pins how the checks reach the full playground: a share link's checks open
// the checks tab with them loaded, the handle hands the list back for the
// share dialog, and a delivered program replaces the list only when it
// carries checks of its own.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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

  it("replaces the list only for a delivery that carries checks, and shows them", async () => {
    const ref = createRef<EmbeddablePlaygroundHandle>();
    render(<EmbeddablePlayground ref={ref} chrome="full" startSource="ret" startChecks={SHARED} />);
    await screen.findByRole("tab", { name: "memory" });
    act(() => ref.current?.loadProgram({ source: "nop" }));
    expect(ref.current?.getChecks()).toEqual(SHARED);
    const next: ProgramCheck[] = [{ name: "prints eight", stdin: "", args: "", stdout: "8\n" }];
    act(() => ref.current?.loadProgram({ source: "nop", checks: next, fromShare: true }));
    expect(ref.current?.getChecks()).toEqual(next);
    expect(screen.getByRole("tab", { name: "checks" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText("prints eight")).toBeTruthy();
  });
});
