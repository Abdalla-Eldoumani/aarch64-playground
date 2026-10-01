// Pins what the Monaco editor does once it mounts: the lint squiggle at page
// load (the first lint of the default program often lands while Monaco is
// still loading, and those warnings must still reach the model once the
// editor mounts, not wait for the next edit), the site theme it follows,
// when it wraps long lines, how its hover cards and colour swatches draw,
// and when the hover card fetches its C line.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Editor } from "@/components/playground/Editor";

type HoverProvider = {
  provideHover: (
    model: { getWordAtPosition: () => unknown; getLineContent: () => string },
    position: { lineNumber: number; column: number },
  ) => Promise<{ contents: { value: string }[] } | null>;
};

const fake = vi.hoisted(() => {
  // Plain fields rather than mock call history, which vitest clears before
  // each test while the providers register once per module.
  const state = { hover: null as HoverProvider | null, cTableLoaded: false };
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
      registerHoverProvider: (_id: string, provider: HoverProvider) => {
        state.hover = provider;
      },
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
  return { state, model, editor, monaco, options: null as null | Record<string, unknown> };
});

// The factory runs when the module is first imported, so the flag says when
// the editor asked for the C table.
vi.mock("@/lib/asm/c-equivalents", async (importOriginal) => {
  fake.state.cTableLoaded = true;
  return importOriginal();
});

vi.mock("@/components/playground/monaco-features", () => ({ MONACO_FEATURES: [] }));
vi.mock("monaco-editor/editor", () => fake.monaco);
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: function MonacoStub({
    onMount,
    options,
  }: {
    onMount: (editor: unknown, monaco: unknown) => void;
    options: Record<string, unknown>;
  }) {
    fake.options = options;
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

describe("Editor line wrap", () => {
  afterEach(() => {
    cleanup();
  });

  // A frame in a reading column cuts a trailing comment off at its edge, so
  // the embed asks for wrapping; the full playground keeps one line per row.
  it("wraps long lines only when the host asks", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    const { rerender } = render(<Editor {...base} wrapLines />);
    await waitFor(() => expect(fake.options?.wordWrap).toBe("on"));
    rerender(<Editor {...base} />);
    await waitFor(() => expect(fake.options?.wordWrap).toBe("off"));
  });
});

describe("Editor overlays", () => {
  afterEach(() => {
    cleanup();
  });

  // `#112` in a vector example read as a CSS colour and drew a swatch, and a
  // frame's overflow cut hover cards that ran past its edge.
  it("draws no colour swatch and fixes hover cards to the window", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    render(<Editor {...base} />);
    await waitFor(() => expect(fake.options).not.toBeNull());
    expect(fake.options?.defaultColorDecorators).toBe("never");
    expect(fake.options?.fixedOverflowWidgets).toBe(true);
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

describe("Editor hover card", () => {
  afterEach(() => {
    cleanup();
  });

  // The C table is the editor's largest module and only the hover card reads
  // it, so it stays out of the editor's chunk until a card needs it.
  it("loads the C table on the first hover and adds its line to the card", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    render(<Editor {...base} />);
    await waitFor(() => expect(fake.state.hover).not.toBeNull());
    expect(fake.state.cTableLoaded).toBe(false);

    const model = {
      getWordAtPosition: () => ({ word: "b", startColumn: 3, endColumn: 4 }),
      getLineContent: () => "  b done",
    };
    const card = await fake.state.hover!.provideHover(model, { lineNumber: 1, column: 3 });
    expect(fake.state.cTableLoaded).toBe(true);
    const text = card!.contents[0].value;
    expect(text.startsWith("**b**")).toBe(true);
    expect(text).toContain("**c equivalent:** `goto label;`");
  });
});
