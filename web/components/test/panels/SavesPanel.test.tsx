import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SavesPanel, type SavesPanelProps } from "@/components/panels/SavesPanel";
import { putSave } from "@/lib/playground/named-saves";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

function renderPanel(overrides: Partial<SavesPanelProps> = {}) {
  const props: SavesPanelProps = {
    savedStates: [],
    onSaveState: vi.fn(),
    onLoadState: vi.fn(),
    onDeleteState: vi.fn(),
    source: "// buffer\nret",
    args: "",
    stepCount: 0,
    onLoadProgram: vi.fn(),
    onRestoreBookmark: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<SavesPanel {...props} />);
  return props;
}

describe("SavesPanel bookmark load", () => {
  it("delivers the whole bookmark as one program handoff, then drives the restore", async () => {
    act(() => {
      putSave({
        name: "week8 walk",
        source: "mov x0, 7",
        args: "./prog 2",
        stdin: "85\n",
        stepCount: 3,
        savedAt: new Date().toISOString(),
      });
    });
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    // Source, args, AND stdin ride one handoff: the machine resets and the
    // bookmark's inputs become the seeds a later manual re-assemble
    // re-applies, instead of whatever program was loaded before it.
    expect(props.onLoadProgram).toHaveBeenCalledWith({
      source: "mov x0, 7",
      label: "week8 walk",
      args: "./prog 2",
      stdin: "85\n",
    });
    await vi.waitFor(() =>
      expect(props.onRestoreBookmark).toHaveBeenCalledWith({
        source: "mov x0, 7",
        args: "./prog 2",
        stdin: "85\n",
        stepCount: 3,
      }),
    );
    // Delivery precedes the restore drive, so the CPU the restore steps
    // belongs to the handed-off program, not the one it replaced.
    expect(
      (props.onLoadProgram as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      (props.onRestoreBookmark as ReturnType<typeof vi.fn>).mock
        .invocationCallOrder[0],
    );
  });

  it("a bookmark without args or stdin still hands off with both undefined", () => {
    act(() => {
      putSave({
        name: "plain",
        source: "ret",
        stepCount: 0,
        savedAt: new Date().toISOString(),
      });
    });
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "load" }));
    // No args and no stdin in the save means none in the handoff: the
    // delivery clears the previous program's inputs rather than keeping them.
    expect(props.onLoadProgram).toHaveBeenCalledWith({
      source: "ret",
      label: "plain",
      args: undefined,
      stdin: undefined,
    });
  });
});
