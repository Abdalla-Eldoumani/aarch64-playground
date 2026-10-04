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
  it("loads the whole bookmark in one handoff, then restores it", async () => {
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
    // One handoff carries source, args, and stdin, so a later re-assemble
    // reuses the bookmark's inputs, not the previous program's.
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
    // The handoff comes first, or the restore would step the program it
    // replaced.
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
