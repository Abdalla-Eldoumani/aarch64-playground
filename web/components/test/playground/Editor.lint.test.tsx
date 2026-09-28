// Pins what the Monaco editor does once it mounts: the lint squiggle at page
// load (the first lint of the default program often lands while Monaco is
// still loading, and those warnings must still reach the model once the
// editor mounts, not wait for the next edit), and the site theme it follows.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Editor } from "@/components/playground/Editor";

const fake = vi.hoisted(() => {
  const model = { getLineCount: () => 3, getLineMaxColumn: () => 12 };
  const editor = {
    getModel: () => model,
    getDomNode: () => null,
    onDidChangeCursorPosition: vi.fn(),
    addCommand: vi.fn(),
    createContextKey: () => ({ set: vi.fn() }),
    onMouseDown: vi.fn(),
    onDidDispose: vi.fn(),
    deltaDecorations: () => [],
    layout: vi.fn(),
    revealLine: vi.fn(),
  };
  const monaco = {
    languages: {
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      registerCompletionItemProvider: vi.fn(),
      registerHoverProvider: vi.fn(),
    },
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
      setModelMarkers: vi.fn(),
      MouseTargetType: { GUTTER_GLYPH_MARGIN: 2 },
    },
    MarkerSeverity: { Warning: 4 },
    KeyCode: { Escape: 9, Enter: 3, KeyF: 36 },
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    Range: class {},
  };
  return { model, editor, monaco };
});

vi.mock("@/components/playground/monaco-features", () => ({ MONACO_FEATURES: [] }));
vi.mock("monaco-editor/features/register.all", () => ({}));
vi.mock("monaco-editor/editor", () => fake.monaco);
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: function MonacoStub({ onMount }: { onMount: (editor: unknown, monaco: unknown) => void }) {
    useEffect(() => onMount(fake.editor, fake.monaco), [onMount]);
    return null;
  },
}));

const base = {
  value: "main:\n  mov x0, 1\n  ret",
  onChange: () => {},
  currentLine: null,
  breakpoints: new Set<number>(),
  onToggleBreakpoint: () => {},
  assemblyErrors: [],
};

describe("Editor lint markers", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks warnings that arrived before Monaco mounted", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    const { rerender } = render(<Editor {...base} lintWarnings={[]} />);
    rerender(<Editor {...base} lintWarnings={[{ line: 2, message: "x0 is never read" }]} />);
    // Monaco's chunk is still on its way, so nothing has been marked yet.
    expect(fake.monaco.editor.setModelMarkers).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(fake.monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(fake.model, "lint", [
        expect.objectContaining({ startLineNumber: 2, endColumn: 12, message: "x0 is never read" }),
      ]),
    );
  });
});

describe("Editor theme", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-theme");
  });

  it("opens in the site's theme and follows every switch", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    document.documentElement.setAttribute("data-theme", "light");
    render(<Editor {...base} />);
    await waitFor(() => expect(fake.monaco.editor.setTheme).toHaveBeenLastCalledWith("arm64-light"));
    document.documentElement.setAttribute("data-theme", "high-contrast");
    await waitFor(() => expect(fake.monaco.editor.setTheme).toHaveBeenLastCalledWith("arm64-hc"));
    document.documentElement.setAttribute("data-theme", "dark");
    await waitFor(() => expect(fake.monaco.editor.setTheme).toHaveBeenLastCalledWith("arm64-dark"));
  });
});
