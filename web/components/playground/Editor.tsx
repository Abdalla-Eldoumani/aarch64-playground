"use client";

import MonacoEditor, { loader, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssemblyError } from "@/lib/emulator/use-emulator";
import { docKeyAt, INSTRUCTION_DOCS } from "@/lib/asm/instruction-docs";
import {
  MNEMONIC_ALTERNATION,
  REGISTER_PATTERN,
} from "@/lib/asm/highlight-arm64";
import { errorHoverMarkdown } from "@/lib/asm/error-explain";
import { buildSuggestions, type Suggestion } from "@/lib/asm/asm-completion";
import { LINE_COMMENT } from "@/lib/asm/line-comment";
import { useToast } from "@/components/ui/Toast";
import { TouchEditor } from "@/components/playground/TouchEditor";
import { MAX_SOURCE_BYTES, checkUploadSize, validateSource } from "@/lib/playground/upload-guard";
import { yieldToEventLoop } from "@/lib/emulator/run-loop";
import { MONACO_FEATURES } from "@/components/playground/monaco-features";

// Monaco comes from the monaco-editor dependency, not the loader's default
// CDN: the installed app must work offline, and a campus network that blocks
// CDNs would leave an empty editor. Only the editor core and its widgets load,
// since the language services are megabytes this editor never uses. The import
// is dynamic because monaco is browser-only and a reader who never types
// should not download it.
let monacoLoad: Promise<void> | null = null;

function loadMonaco(): Promise<void> {
  monacoLoad ??= (async () => {
    // Monaco reads this global lazily, when it first needs a worker. The
    // base editor worker is the only one to wire up (no language services),
    // and it is bundled from the package for the same offline reason.
    self.MonacoEnvironment = {
      getWorker: () =>
        new Worker(
          new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
          // The worker name is also the bundler's chunk name, which is what
          // lets the bundle budget in package.json glob the editor's assets
          // by name instead of by a hashed webpack id that moves with any
          // change to the module graph.
          { name: "monaco-worker" },
        ),
    };
    // The widgets register themselves on import and the API entry registers
    // nothing, so both load, widgets first as monaco's own entry orders them,
    // under one chunk name so the size budget sees one file. Each feature runs
    // in its own task, since one big import blocks input for a quarter second
    // or more. The list's test keeps it in step with monaco's register.all,
    // which is not imported: it would bring back the feature the list leaves out.
    for (const load of MONACO_FEATURES) {
      await load();
      await yieldToEventLoop();
    }
    const monaco = await import(/* webpackChunkName: "monaco" */ "monaco-editor/editor");
    await yieldToEventLoop();
    // The first language or theme call starts every editor service. Made
    // here, that start-up is a task of its own instead of part of the
    // editor's creation.
    ensureArm64Registered(monaco);
    loader.config({ monaco });
  })();
  return monacoLoad;
}

let arm64Registered = false;

// Monaco takes `fontFamily` as a literal font list and cannot read a CSS
// variable, so this resolves --font-mono (set in app/layout.tsx) rather than
// restating it. That keeps next/font's metric-matched fallback face in front:
// Monaco measures one glyph at creation, and an editor made during the font
// swap kept Consolas's column width.
const MONO_FALLBACKS = "'JetBrains Mono', 'Fira Code', Consolas, monospace";
let monoFontFamily: string | null = null;

function resolveMonoFontFamily(): string {
  if (monoFontFamily) return monoFontFamily;
  if (typeof document === "undefined") return MONO_FALLBACKS;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  // An empty read means the font stylesheet has not landed yet; answer with
  // the fallbacks and leave the cache unset so a later mount can still catch
  // the real family instead of pinning the miss for the whole session.
  if (!resolved) return MONO_FALLBACKS;
  monoFontFamily = `${resolved}, ${MONO_FALLBACKS}`;
  return monoFontFamily;
}

/** Set Monaco's global theme from the document's data-theme. Called per
 *  mount (the MonacoEditor `theme` prop re-asserts arm64-dark on every
 *  mount) and by the module-level attribute observer on theme switches. */
function applyDocumentTheme(monaco: Parameters<OnMount>[1]): void {
  const t = document.documentElement.getAttribute("data-theme");
  const id = t === "light" ? "arm64-light" : t === "high-contrast" ? "arm64-hc" : "arm64-dark";
  monaco.editor.setTheme(id);
}

/**
 * One-time global setup: the arm64 language, themes, and providers. Monaco's
 * registries are tab-wide and add up, so registering per mount stacked a copy
 * of every hover card and completion on each remount.
 */
function ensureArm64Registered(monaco: Parameters<OnMount>[1]): void {
  if (arm64Registered) return;
  arm64Registered = true;

  monaco.languages.register({ id: "arm64" });
  // Comment tokens drive Monaco's built-in toggles: Ctrl+/ (Cmd+/) line-
  // toggles with `//`, Shift+Alt+A block-toggles with the GAS `/* */` pair
  // the m4 pass strips. The commands read this config live, so registering
  // it here (once, before first keypress) is enough.
  monaco.languages.setLanguageConfiguration("arm64", {
    comments: { lineComment: LINE_COMMENT, blockComment: ["/*", "*/"] },
  });
  monaco.languages.setMonarchTokensProvider("arm64", {
    ignoreCase: true,
    tokenizer: {
      root: [
        [/\/\*/, "comment", "@blockComment"],
        [/\/\/.*$/, "comment"],
        [/;.*$/, "comment"],
        // The keyword set is the highlighter's, which is the hover-card
        // table's, which the drift guards pin to the assembler's own
        // SUPPORTED_MNEMONICS: one list, three surfaces. Only the conditional
        // branches are added here, because that table folds the whole family
        // onto a single placeholder entry.
        [
          new RegExp(
            `\\b(${[MNEMONIC_ALTERNATION, ...COND_BRANCHES].join("|")})\\b`,
            "i",
          ),
          "keyword",
        ],
        // The register file, from the same alternation the reading surfaces
        // test against, so the two cannot drift. Its trailing lookahead is
        // what stops Monarch colouring a prefix of a name that is not one:
        // `x31` and `v3.3s` stay plain.
        [new RegExp(REGISTER_PATTERN, "i"), "variable"],
        [/#-?0x[0-9a-fA-F]+/, "number.hex"],
        [/#-?[0-9]+/, "number"],
        [/\w+:/, "type.identifier"],
      ],
      blockComment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  });

  // Monaco themes take literal hex only, so these restate the tokens in
  // app/globals.css (the caret is the amber block cursor). Keep the two files
  // in step when a token moves.
  monaco.editor.defineTheme("arm64-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "6fa8ff", fontStyle: "bold" },
      { token: "variable", foreground: "ff7eb6" },
      { token: "number", foreground: "b49bff" },
      { token: "number.hex", foreground: "b49bff" },
      { token: "comment", foreground: "7a828c", fontStyle: "italic" },
      { token: "type.identifier", foreground: "3dd68c" },
    ],
    colors: {
      "editor.background": "#0B0C10",
      "editor.lineHighlightBackground": "#14171DAA",
      "editorGutter.background": "#0B0C10",
      "editorLineNumber.foreground": "#79808B",
      "editorCursor.foreground": "#FFB224",
      "editorCursor.background": "#0B0C10",
      "textLink.foreground": "#3EC5E8",
      "textLink.activeForeground": "#3EC5E8",
    },
  });

  monaco.editor.defineTheme("arm64-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "1d4ed8", fontStyle: "bold" },
      { token: "variable", foreground: "be185d" },
      { token: "number", foreground: "6d28d9" },
      { token: "number.hex", foreground: "6d28d9" },
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "type.identifier", foreground: "036b4d" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#F4F5F7CC",
      "editorGutter.background": "#FFFFFF",
      "editorLineNumber.foreground": "#626A73",
      "editorCursor.foreground": "#A86A0F",
      "editorCursor.background": "#FFFFFF",
      "textLink.foreground": "#0E7490",
      "textLink.activeForeground": "#0E7490",
    },
  });

  monaco.editor.defineTheme("arm64-hc", {
    base: "hc-black",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "8be0ff", fontStyle: "bold" },
      { token: "variable", foreground: "ffb6e6" },
      { token: "number", foreground: "d4b6ff" },
      { token: "number.hex", foreground: "d4b6ff" },
      { token: "comment", foreground: "d1d5db", fontStyle: "italic" },
      { token: "type.identifier", foreground: "9ef0c1" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.lineHighlightBackground": "#1A1A1A",
      "editorGutter.background": "#000000",
      "editorLineNumber.foreground": "#C7C7C7",
      "editorCursor.foreground": "#FFC247",
      "editorCursor.background": "#000000",
      "textLink.foreground": "#5AD7F0",
      "textLink.activeForeground": "#5AD7F0",
    },
  });

  const observer = new MutationObserver(() => applyDocumentTheme(monaco));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Completion provider: builds context-aware suggestions from the
  // current line + the full source (for labels and m4 aliases).
  type CompletionModel = Parameters<
    Parameters<typeof monaco["languages"]["registerCompletionItemProvider"]>[1]["provideCompletionItems"]
  >[0];
  type CompletionPos = Parameters<
    Parameters<typeof monaco["languages"]["registerCompletionItemProvider"]>[1]["provideCompletionItems"]
  >[1];
  monaco.languages.registerCompletionItemProvider("arm64", {
    triggerCharacters: [".", " ", ",", "[", "$", "_"],
    provideCompletionItems(model: CompletionModel, position: CompletionPos) {
      const line = model.getLineContent(position.lineNumber);
      const source = model.getValue();
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );
      const suggestions = buildSuggestions({
        source,
        line,
        position: position.column,
      });
      return {
        suggestions: suggestions.map((s) => mapSuggestion(s, monaco, range)),
      };
    },
  });

  // Hover provider: surface a short course-voice summary of the
  // mnemonic under the cursor. Falls back to no-hover when the
  // token under the cursor isn't one we recognize.
  type MonacoModule = typeof monaco;
  type TextModel = Parameters<
    Parameters<MonacoModule["languages"]["registerHoverProvider"]>[1]["provideHover"]
  >[0];
  type MonacoPosition = Parameters<
    Parameters<MonacoModule["languages"]["registerHoverProvider"]>[1]["provideHover"]
  >[1];
  monaco.languages.registerHoverProvider("arm64", {
    async provideHover(model: TextModel, position: MonacoPosition) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      // The lookup rule (including the dotted conditional form) lives beside
      // the table in lib/asm/instruction-docs, so this provider holds none of
      // it and the whole path is pinned without Monaco.
      const line = model.getLineContent(position.lineNumber);
      const key = docKeyAt(line, word.word, word.startColumn);
      if (key === undefined) return null;
      const doc = INSTRUCTION_DOCS[key];
      const lines: string[] = [
        `**${word.word.toLowerCase()}** · ${doc.summary}`,
      ];
      if (doc.details) {
        lines.push("", ...doc.details);
      }
      if (doc.example) {
        lines.push("", "```", doc.example, "```");
      }
      // The C table is 80 KB that only this line reads, so it loads on the
      // first hover instead of with the editor.
      try {
        const { hoverCLine } = await import("@/lib/asm/c-equivalents");
        const c = hoverCLine(key, window.location.origin);
        if (c) lines.push("", c);
      } catch {
        // Offline with an older cache: the card goes out without its C line.
      }
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
        contents: [{ value: lines.join("\n") }],
      };
    },
  });
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  /** The pc is inside a libc call and `currentLine` is the call site, so the
   *  marker goes quieter: three steps inside printf should not read as three
   *  steps on the `bl`. */
  currentLineInCall?: boolean;
  breakpoints: Set<number>;
  onToggleBreakpoint: (line: number) => void;
  assemblyErrors: AssemblyError[];
  /** Advisory pre-assembly lint warnings, rendered as Monaco WARNING
   *  markers (yellow squiggles with the remedy in the hover). */
  lintWarnings?: AssemblyError[];
  onCursorChange?: (pos: { line: number; column: number }) => void;
  /** Format-source command bound to Ctrl+Shift+F inside Monaco. The
   *  parent owns the formatter implementation so the keybinding and
   *  the command-palette entry share one code path. */
  onFormat?: () => void;
  /** When true the surface rejects input: Monaco and the phone fallback
   *  both become read-only (embed and checker snapshots). */
  readOnly?: boolean;
  /** Jump the editor to a line (an error the student should fix): the
   *  parent bumps the nonce so the same line can be requested twice. */
  focusRequest?: { line: number; nonce: number } | null;
  /** Keep the current line in view. Off during a run (the marker moves many
   *  times a second) and before the first step (assembling must not scroll
   *  away from the line being edited); turning it back on reveals the line,
   *  which shows a breakpoint hit when a run stops. */
  followCurrentLine?: boolean;
  /** Ctrl+Enter (Cmd+Enter) inside the editor. Monaco binds that chord to
   *  "insert line below" and stops the key there, so the page's own shortcut
   *  never saw it; a surface that runs programs passes its action here. */
  onRunShortcut?: () => void;
  /** Wrap long lines in Monaco instead of scrolling them sideways: a frame in
   *  a reading column is too narrow for a comment at the end of a line, and
   *  its horizontal scrollbar stays hidden until hovered. The touch editor
   *  scrolls sideways with a visible bar either way. */
  wrapLines?: boolean;
}

const COND_BRANCHES = [
  "B.EQ", "B.NE", "B.HS", "B.LO", "B.MI", "B.PL",
  "B.VS", "B.VC", "B.HI", "B.LS", "B.GE", "B.LT", "B.GT", "B.LE",
  "B.CS", "B.CC",
];

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Touch screens get the textarea editor at every size: Monaco's caret jumps
// lines when a soft keyboard shrinks the view, and its iPad keyboard button
// sits on the code. Pointer type never changes on rotation, so the editor, its
// caret, and its undo history survive a turn of the phone. A mouse gets it
// only in a window too narrow for Monaco's gutter and code together.
function wantsTouchEditor(): boolean {
  if (typeof window === "undefined") return false;
  return isCoarsePointer() || window.innerWidth < 480;
}

export function Editor({
  value,
  onChange,
  currentLine,
  currentLineInCall = false,
  breakpoints,
  onToggleBreakpoint,
  assemblyErrors,
  lintWarnings = [],
  onCursorChange,
  onFormat,
  readOnly,
  focusRequest,
  followCurrentLine = true,
  onRunShortcut,
  wrapLines = false,
}: EditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);
  // Lint markers live in Monaco's marker system (owner "lint"), separate
  // from the decoration pipeline: markers give the yellow squiggle, the
  // hover message, and the problems affordance for free. The first lint of a
  // page load often lands while Monaco is still loading, so the mount applies
  // the latest warnings too, not only a change to them.
  const lintRef = useRef(lintWarnings);
  const applyLint = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      "lint",
      lintRef.current.map((w) => ({
        severity: monaco.MarkerSeverity.Warning,
        message: w.message,
        startLineNumber: w.line,
        startColumn: 1,
        endLineNumber: w.line,
        endColumn: model.getLineMaxColumn(Math.min(w.line, model.getLineCount())),
      })),
    );
  }, []);
  useEffect(() => {
    lintRef.current = lintWarnings;
    applyLint();
  }, [lintWarnings, applyLint]);
  const [fallback, setFallback] = useState<boolean>(() => wantsTouchEditor());
  // Keep the latest format handler accessible from the Monaco command
  // (registered once at mount).
  const onFormatRef = useRef(onFormat);
  useEffect(() => {
    onFormatRef.current = onFormat;
  }, [onFormat]);
  // Same for the run chord, plus the context key that decides whether Monaco
  // gives the chord to it at all: without a handler, Ctrl+Enter keeps its
  // stock "insert line below".
  const onRunShortcutRef = useRef(onRunShortcut);
  const canRunKeyRef = useRef<{ set: (value: boolean) => void } | null>(null);
  useEffect(() => {
    onRunShortcutRef.current = onRunShortcut;
    canRunKeyRef.current?.set(Boolean(onRunShortcut));
  }, [onRunShortcut]);
  const toast = useToast();
  // The vendored build has to be named to the loader BEFORE
  // @monaco-editor/react asks for it: an unnamed instance is exactly what sends
  // the loader off to its CDN default. Child effects run first, so the editor
  // itself mounts once the chunk is in. A phone-fallback mount never requests
  // the chunk at all.
  const [monacoReady, setMonacoReady] = useState(false);
  useEffect(() => {
    if (fallback) return;
    let live = true;
    void loadMonaco().then(
      () => {
        if (live) setMonacoReady(true);
      },
      () => {
        if (live) toast.error("the editor failed to load. reload the page to try again");
      },
    );
    return () => {
      live = false;
    };
  }, [fallback, toast]);

  // Guard the source ingress (typing, paste, and drop all flow here). A
  // change that would push the buffer over MAX_SOURCE_BYTES is rejected and
  // the last in-bounds buffer is kept.
  const handleChange = useCallback(
    (next: string) => {
      const error = validateSource(next);
      if (error) {
        toast.error(error);
        // A rejected over-cap input goes to the console as well as the toast,
        // per the input-validation policy.
        console.warn(`rejected over-cap source: ${error}`);
        return;
      }
      onChange(next);
    },
    [onChange, toast],
  );

  // Re-evaluate on resize so a desktop window dragged narrow or wide gets
  // the editor that fits it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setFallback(wantsTouchEditor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const updateDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const decorations: Parameters<typeof editor.deltaDecorations>[1] = [];

    // current line highlight: the in-call variant is its own class, not a
    // second one layered on top: both set `background` with !important, so
    // which one won would depend on the order of the rules in the block.
    if (currentLine != null) {
      decorations.push({
        range: new monaco.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: currentLineInCall ? "current-line-in-call" : "current-line-highlight",
          glyphMarginClassName: currentLineInCall
            ? "current-line-glyph-in-call"
            : "current-line-glyph",
        },
      });
    }

    for (const line of breakpoints) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: "breakpoint-glyph",
        },
      });
    }

    for (const err of assemblyErrors) {
      decorations.push({
        range: new monaco.Range(err.line, 1, err.line, 1),
        options: {
          isWholeLine: true,
          className: "error-line-highlight",
          glyphMarginClassName: "error-glyph",
          hoverMessage: { value: errorHoverMarkdown(err.message), isTrusted: false },
        },
      });
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [currentLine, currentLineInCall, breakpoints, assemblyErrors]);

  // Jump-to-error: reveal, place the cursor, and focus so the student
  // lands on the offending line instead of hunting for it.
  useEffect(() => {
    if (!focusRequest) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(focusRequest.line);
    editor.setPosition({ lineNumber: focusRequest.line, column: 1 });
    editor.focus();
  }, [focusRequest]);

  // Follow the pc: a step or a stop below the fold brings the line into view
  // by the nearest scroll, as the phone fallback does, so stepping through
  // visible code never scrolls. The cursor stays where the student left it.
  useEffect(() => {
    if (currentLine == null || !followCurrentLine) return;
    editorRef.current?.revealLine(currentLine);
  }, [currentLine, followCurrentLine]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Per mount: the component prop above just forced arm64-dark; put
      // the document's theme back before first paint settles.
      applyDocumentTheme(monaco);

      // Surface cursor position to the parent so the share-state hash
      // can encode it. The callback fires on arrow keys, click, and any
      // edit; the parent throttles persistence as needed.
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.({ line: e.position.lineNumber, column: e.position.column });
      });

      // Set an aria-label so screen readers announce the editor as more
      // than "edit text"; Monaco's default label is generic.
      editor.getDomNode()?.setAttribute("aria-label", "ARM64 assembly source code editor");

      // Escape leaves the editor so a keyboard user is not trapped (Tab indents
      // in here). Focus sits on Monaco's inner input, so that is what blurs.
      // The context lets Monaco's own Escape go first, closing find or suggest
      // or collapsing a selection; a second Escape leaves.
      editor.addCommand(
        monaco.KeyCode.Escape,
        () => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && editor.getDomNode()?.contains(active)) {
            active.blur();
          }
        },
        "!findWidgetVisible && !suggestWidgetVisible && !editorHasSelection && !editorHasMultipleSelections",
      );

      const canRun = editor.createContextKey("playgroundCanRun", Boolean(onRunShortcutRef.current));
      canRunKeyRef.current = canRun;
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => onRunShortcutRef.current?.(),
        "playgroundCanRun",
      );

      // Ctrl+Shift+F invokes the playground's source formatter (the
      // command palette uses the same handler). Mirrors VS Code's
      // "Format Document" binding so muscle memory transfers.
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
        () => onFormatRef.current?.(),
      );

      editor.onMouseDown((e) => {
        if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          return;
        }
        const line = e.target.position?.lineNumber;
        if (line != null) {
          onToggleBreakpoint(line);
        }
      });

      // On coarse pointers, the breakpoint gesture is a single tap on the glyph
      // margin. The CSS below widens that margin to 32px so a fingertip lands
      // reliably. An anywhere-on-line long-press would fight text selection.

      // Shrink the editor when the iOS keyboard opens so the textarea
      // doesn't sit behind the keyboard; Monaco's `automaticLayout` flag
      // only handles viewport changes, not keyboard-induced visual-
      // viewport changes.
      if (typeof window !== "undefined" && "visualViewport" in window) {
        const vv = window.visualViewport;
        if (vv) {
          const onVvResize = () => editor.layout();
          vv.addEventListener("resize", onVvResize);
          // The listener holds the editor alive; every remount (the
          // pitfalls catalog toggles remount the embed) stacked another.
          editor.onDidDispose(() => vv.removeEventListener("resize", onVvResize));
        }
      }

      updateDecorations();
      applyLint();
    },
    [onToggleBreakpoint, updateDecorations, applyLint, onCursorChange]
  );

  useEffect(() => {
    updateDecorations();
  }, [currentLine, currentLineInCall, breakpoints, assemblyErrors, updateDecorations]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      // Cancel the drop FIRST: an early return before preventDefault let the
      // browser's default run, and the default for a dropped file is navigating
      // the tab to file://, which loses the whole machine state.
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!/\.(s|asm|txt)$/i.test(file.name)) {
        toast.error(
          "only .s, .asm, and .txt files can be dropped here. rename the file, or paste its contents into the editor",
        );
        return;
      }
      // Check the declared size before reading: the import picker does the
      // same, and reading first would materialize an arbitrarily large file
      // as a string just to reject it.
      const sizeError = checkUploadSize(file.size, MAX_SOURCE_BYTES, "source file");
      if (sizeError) {
        toast.error(sizeError);
        return;
      }
      file
        .text()
        .then((text) => handleChange(text))
        .catch(() => {
          toast.error("could not read the dropped file. drop it again, or paste its contents into the editor");
        });
    },
    [handleChange, toast],
  );

  if (fallback) {
    return (
      <TouchEditor
        value={value}
        onChange={handleChange}
        currentLine={currentLine}
        currentLineInCall={currentLineInCall}
        breakpoints={breakpoints}
        onToggleBreakpoint={onToggleBreakpoint}
        assemblyErrors={assemblyErrors}
        onDrop={onDrop}
        onCursorChange={onCursorChange}
        readOnly={readOnly}
        focusRequest={focusRequest}
        followCurrentLine={followCurrentLine}
      />
    );
  }

  return (
    <div
      className="h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <style>{`
        /* Injected here rather than globals.css: Monaco owns these class names,
           so they live beside the decorations that set them. */
        .current-line-highlight { background: color-mix(in srgb, var(--amber) 14%, transparent) !important; box-shadow: inset 2px 0 0 0 var(--amber); }
        /* Inside a libc call: same amber at a lower alpha, and the solid left
           rule becomes a dashed one. Drawn as a background layer rather than
           a border so the code does not shift 2px sideways for three steps.
           Nothing here animates, so reduced motion needs no variant. */
        .current-line-in-call { background: repeating-linear-gradient(to bottom, var(--amber) 0 4px, transparent 4px 8px) left / 2px 100% no-repeat, color-mix(in srgb, var(--amber) 6%, transparent) !important; }
        .current-line-glyph { background: var(--amber); border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .current-line-glyph-in-call { border: 1px solid var(--amber); border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .breakpoint-glyph { background: var(--danger); border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .error-line-highlight { background: color-mix(in srgb, var(--danger) 15%, transparent) !important; }
        .error-glyph { background: var(--danger); border-radius: 2px; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        @media (pointer: coarse) {
          .monaco-editor .glyph-margin { width: 32px !important; }
        }
      `}</style>
      {monacoReady ? (
        <MonacoEditor
          height="100%"
          language="arm64"
          theme="arm64-dark"
          value={value}
          onChange={(v) => handleChange(v ?? "")}
          onMount={handleMount}
          options={{
            // 16px font on mobile kills iOS's focus-zoom behavior; keep
            // 14 on desktop where the ems cost is worth it.
            fontSize: isCoarsePointer() ? 16 : 14,
            fontFamily: resolveMonoFontFamily(),
            minimap: { enabled: false },
            glyphMargin: true,
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: wrapLines || isCoarsePointer() ? "on" : "off",
            // Monaco's stock colour finder reads `#112` as a CSS colour and
            // drew a swatch before the immediate.
            defaultColorDecorators: "never",
            // Hover cards are fixed to the window, so a frame's overflow no
            // longer cuts them: an embed clipped up to 139 px off a card's
            // right edge, and the playground's pane hid the top of an error
            // card that opened above it.
            fixedOverflowWidgets: true,
            // The block caret is the site's brand cursor, here in the one place
            // it is a real cursor. It blinks hard on/off; when the reader asks
            // for reduced motion it holds solid instead, same fallback as the
            // CSS cursor elsewhere.
            cursorStyle: "block",
            cursorBlinking: prefersReducedMotion() ? "solid" : "blink",
            accessibilitySupport: "auto",
            // Enter always ends the line; Tab takes a suggestion. With the
            // stock setting, `mov x0, x1` then Enter accepted `x1` from the
            // open list and the next instruction landed on the same line.
            acceptSuggestionOnEnter: "off",
            // What a screen reader announces on entering the editor: the way
            // out, since Tab is taken by indentation in here.
            ariaLabel: "assembly source. Tab indents; press Escape, then Tab, to leave the editor",
            readOnly,
          }}
        />
      ) : (
        <div
          className="flex h-full items-center justify-center font-mono text-[12px] text-[var(--text-tertiary)]"
          role="status"
        >
          loading editor...
        </div>
      )}
    </div>
  );
}

type MonacoForCompletion = Parameters<OnMount>[1];

function mapSuggestion(
  s: Suggestion,
  monaco: MonacoForCompletion,
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number },
) {
  const KIND = monaco.languages.CompletionItemKind;
  const kindMap: Record<Suggestion["kind"], number> = {
    directive: KIND.Keyword,
    instruction: KIND.Function,
    register: KIND.Variable,
    alias: KIND.Variable,
    label: KIND.Reference,
    libc: KIND.Function,
  };
  return {
    label: s.label,
    kind: kindMap[s.kind],
    detail: s.detail,
    insertText: s.insertText ?? s.label,
    range,
  };
}
