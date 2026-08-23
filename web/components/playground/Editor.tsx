"use client";

import MonacoEditor, { loader, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AssemblyError } from "@/lib/emulator/use-emulator";
import { lookupDoc } from "@/lib/asm/instruction-docs";
import { explainError } from "@/lib/asm/error-explain";
import { buildSuggestions, type Suggestion } from "@/lib/asm/asm-completion";
import { LINE_COMMENT, toggleLineComment } from "@/lib/asm/line-comment";
import { useToast } from "@/components/ui/Toast";
import { MAX_SOURCE_BYTES, checkUploadSize, validateSource } from "@/lib/playground/upload-guard";

// The editor runtime is vendored from the monaco-editor dependency instead
// of fetched from the loader's default CDN: the installed PWA has to keep
// working offline, and a campus network that filters public CDNs would
// otherwise leave a student with an empty editor pane. One dependency pin
// now decides both the runtime build and the compile-time types.
//
// Two details of the arrangement carry their own reasons:
//   - `edcore.main` is monaco's editor-only entry: every widget the
//     playground uses (suggest, hover, find) and none of the bundled
//     language services. This editor registers arm64 itself and never asks
//     for another language, so those services -- and the extra workers
//     they need -- would be megabytes of dead weight.
//   - the import is dynamic because monaco is a browser-only module and
//     this component is rendered on the server too, and because the editor
//     belongs in its own async chunk: the landing page composes this same
//     component, and a reader who never types should not download an
//     editor.
let monacoLoad: Promise<void> | null = null;

function loadMonaco(): Promise<void> {
  monacoLoad ??= (async () => {
    // Monaco reads this global lazily, when it first needs a worker. The
    // base editor worker is the only one to wire up (no language services),
    // and it is bundled from the package for the same offline reason.
    self.MonacoEnvironment = {
      getWorker: () =>
        new Worker(
          new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
          // The worker name is also the bundler's chunk name, which is what
          // lets the bundle budget in package.json glob the editor's assets
          // by name instead of by a hashed webpack id that moves with any
          // change to the module graph.
          { name: "monaco-worker" },
        ),
    };
    const monaco = await import(
      /* webpackChunkName: "monaco" */ "monaco-editor/esm/vs/editor/edcore.main.js"
    );
    loader.config({ monaco });
  })();
  return monacoLoad;
}

let arm64Registered = false;

// Monaco reads `fontFamily` as a literal CSS font list and never resolves a
// custom property through it, so this one option cannot just name
// --font-mono the way every other surface does. Hardcoding the stack instead
// dropped the half of it that matters most: next/font emits the webfont as
// "JetBrains Mono" AND a metric-matched local stand-in, "JetBrains Mono
// Fallback" (size-adjust + ascent-override tuned to the real face), and
// publishes both as --font-mono on <html> (app/layout.tsx). Monaco measures
// one glyph's advance at creation and lays the whole grid on it, so an editor
// created during the swap window measured Consolas and kept the wrong column
// width. Resolving the variable puts the metric-matched face in front of the
// generic ones, and keeps the page's stack the only place it is written.
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
 * One-time global Monaco setup: the arm64 language, its tokenizer and
 * themes, the theme-attribute observer, and the completion + hover
 * providers. Monaco's registries are tab-global and CONCATENATE
 * providers, so registering per mount stacked N copies of every hover
 * card and completion after N mounts (the pitfalls catalog remounts
 * the embed on every fault/fix toggle). Per-editor wiring stays in
 * handleMount.
 */
function ensureArm64Registered(monaco: Parameters<OnMount>[1]): void {
  if (arm64Registered) return;
  arm64Registered = true;

  // register ARM64 language
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
        [
          new RegExp(
            `\\b(${[...ARM64_MNEMONICS, ...COND_BRANCHES].join("|")})\\b`,
            "i"
          ),
          "keyword",
        ],
        [/\b(X[0-9]|X[12][0-9]|X30|W[0-9]|W[12][0-9]|W30|SP|XZR|WZR)\b/i, "variable"],
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

  // Monaco themes take literal hex only, so these restate token values
  // from app/globals.css: the editor sits on --bg-base with --bg-raised
  // as the resting line highlight, line numbers read --text-tertiary,
  // and the caret is the brand block cursor in --amber (the machine's
  // color: the block marks where the machine will write next). Keep the
  // two files in step when a token moves.
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
      { token: "type.identifier", foreground: "047857" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.lineHighlightBackground": "#F4F5F7CC",
      "editorGutter.background": "#FFFFFF",
      "editorLineNumber.foreground": "#626A73",
      "editorCursor.foreground": "#A86A0F",
      "editorCursor.background": "#FFFFFF",
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
    provideHover(model: TextModel, position: MonacoPosition) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      // Grab the possibly-dotted conditional form (e.g. "B.EQ").
      const line = model.getLineContent(position.lineNumber);
      const dotStart = word.startColumn - 1;
      const extended =
        line[dotStart - 1] === "." && /[A-Za-z]/.test(line[dotStart - 2] ?? "")
          ? `${line[dotStart - 2]}.${word.word}`
          : word.word;
      const doc = lookupDoc(extended) ?? lookupDoc(word.word);
      if (!doc) return null;
      const lines: string[] = [
        `**${word.word.toUpperCase()}** -- ${doc.summary}`,
      ];
      if (doc.details) {
        lines.push("", ...doc.details);
      }
      if (doc.example) {
        lines.push("", "```", doc.example, "```");
      }
      if (doc.cExample) {
        lines.push("", `**c equivalent:** \`${doc.cExample}\``);
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
  /**
   * True while the pc is inside a hosted libc call, where `currentLine` is
   * the call SITE rather than the executing instruction. The current-line
   * decoration takes a quieter variant (dashed rule, lighter fill) so three
   * steps spent inside printf do not read as three steps on the `bl`.
   */
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
}

const ARM64_MNEMONICS = [
  "MOV", "MOVZ", "MOVK", "MOVN",
  "ADD", "ADDS", "SUB", "SUBS", "MUL", "MADD", "MSUB", "UDIV", "SDIV", "NEG",
  "AND", "ANDS", "ORR", "EOR", "MVN", "TST",
  "LSL", "LSR", "ASR", "ROR",
  "SXTB", "SXTH", "SXTW", "UXTB", "UXTH",
  "CMP", "CMN",
  "LDR", "STR", "LDRB", "STRB", "LDRH", "STRH", "LDP", "STP",
  "LDRSB", "LDRSH", "LDRSW",
  "ADR", "ADRP",
  "B", "BL", "BR", "BLR", "RET",
  "CBZ", "CBNZ", "TBZ", "TBNZ",
  "CSEL", "CSINC", "CSET",
  "NOP", "SVC",
  "FMOV", "FADD", "FSUB", "FMUL", "FDIV", "FCMP", "SCVTF", "FCVTZS",
];

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

function isNarrow(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 480;
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
}: EditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);
  // Lint markers live in Monaco's marker system (owner "lint"), separate
  // from the decoration pipeline: markers give the yellow squiggle, the
  // hover message, and the problems affordance for free.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      "lint",
      lintWarnings.map((w) => ({
        severity: monaco.MarkerSeverity.Warning,
        message: w.message,
        startLineNumber: w.line,
        startColumn: 1,
        endLineNumber: w.line,
        endColumn: model.getLineMaxColumn(Math.min(w.line, model.getLineCount())),
      })),
    );
  }, [lintWarnings]);
  const [fallback, setFallback] = useState<boolean>(() => isNarrow());
  // Keep the latest format handler accessible from the Monaco command
  // (registered once at mount).
  const onFormatRef = useRef(onFormat);
  useEffect(() => {
    onFormatRef.current = onFormat;
  }, [onFormat]);
  const toast = useToast();
  // The vendored build has to be named to the loader BEFORE
  // @monaco-editor/react asks for it -- an unnamed instance is exactly what
  // sends the loader off to its CDN default -- and child effects run first,
  // so the editor itself mounts once the chunk is in. A phone-fallback
  // mount never requests the chunk at all.
  const [monacoReady, setMonacoReady] = useState(false);
  useEffect(() => {
    if (fallback) return;
    let live = true;
    void loadMonaco().then(
      () => {
        if (live) setMonacoReady(true);
      },
      () => {
        if (live) toast.error("the editor failed to load -- reload the page to try again");
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
        // Intentional security observability: a rejected over-cap input is
        // surfaced to the console alongside the toast, per the input-
        // validation policy. This is the only sanctioned console use here.
        console.warn(`rejected over-cap source: ${error}`);
        return;
      }
      onChange(next);
    },
    [onChange, toast],
  );

  // Re-evaluate the narrow-viewport fallback on resize so a student
  // who rotates their phone doesn't get stuck in the wrong mode.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setFallback(isNarrow());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const updateDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const decorations: Parameters<typeof editor.deltaDecorations>[1] = [];

    // current line highlight -- the in-call variant is its own class, not a
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

    // breakpoints
    for (const line of breakpoints) {
      decorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: "breakpoint-glyph",
        },
      });
    }

    // assembly errors -- the hover bubble carries both the raw message
    // and, when the explainer recognizes the variant, a structured
    // {what / why / fix / consult} block keyed to a style-guide section.
    for (const err of assemblyErrors) {
      const explanation = explainError(err.message);
      const md = explanation
        ? [
            `**${err.message}**`,
            "",
            `*what:* ${explanation.what}`,
            "",
            `*why:* ${explanation.why}`,
            "",
            `*fix:* ${explanation.fix}`,
            "",
            `*consult:* ${explanation.styleSection} (docs/cpsc355-style-guide.md)`,
          ].join("\n")
        : err.message;
      decorations.push({
        range: new monaco.Range(err.line, 1, err.line, 1),
        options: {
          isWholeLine: true,
          className: "error-line-highlight",
          glyphMarginClassName: "error-glyph",
          hoverMessage: { value: md, isTrusted: false },
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

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      ensureArm64Registered(monaco);
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

      // Escape blurs the editor when no internal Monaco widget is open,
      // so keyboard-only users aren't trapped inside Monaco when they
      // hit Esc to back out of a focused control.
      editor.addCommand(monaco.KeyCode.Escape, () => {
        editor.getDomNode()?.blur();
      });

      // Ctrl+Shift+F invokes the playground's source formatter (the
      // command palette uses the same handler). Mirrors VS Code's
      // "Format Document" binding so muscle memory transfers.
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
        () => onFormatRef.current?.(),
      );

      // glyph margin click for breakpoints
      editor.onMouseDown((e) => {
        if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          return;
        }
        const line = e.target.position?.lineNumber;
        if (line != null) {
          onToggleBreakpoint(line);
        }
      });

      // On coarse pointers, the breakpoint gesture is a single tap on
      // the glyph margin. The CSS below widens that margin to 32px so a
      // fingertip lands reliably; no anywhere-on-line long-press, which
      // used to fight text selection.

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
    },
    [onToggleBreakpoint, updateDecorations, onCursorChange]
  );

  // re-apply decorations when the editor or any of its inputs change
  useEffect(() => {
    updateDecorations();
  }, [currentLine, currentLineInCall, breakpoints, assemblyErrors, updateDecorations]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      // Cancel the drop FIRST: an early return before preventDefault let
      // the browser's default run, and the default for a dropped file is
      // navigating the tab to file:// -- the whole machine state gone.
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!/\.(s|asm|txt)$/i.test(file.name)) {
        toast.error(
          "only .s, .asm, and .txt files can be dropped here -- rename the file or paste its contents",
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
          toast.error("could not read the dropped file -- try again or paste its contents");
        });
    },
    [handleChange, toast],
  );

  if (fallback) {
    // Under 480px, Monaco's keyboard behavior on iOS is unreliable
    // (the soft keyboard jumps the caret to the wrong line when the
    // visual viewport shrinks). Fall back to a plain textarea with a
    // synced gutter that surfaces line numbers, breakpoint dots, the
    // current PC line, and the first assembler error so a student can
    // still navigate errors and toggle breakpoints on a phone.
    return <FallbackEditor
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
    />;
  }

  return (
    <div
      className="h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <style>{`
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
            wordWrap: isCoarsePointer() ? "on" : "off",
            // The block caret is the site's brand cursor, here in the one place
            // it is a real cursor. It blinks hard on/off; when the reader asks
            // for reduced motion it holds solid instead, same fallback as the
            // CSS cursor elsewhere.
            cursorStyle: "block",
            cursorBlinking: prefersReducedMotion() ? "solid" : "blink",
            accessibilitySupport: "auto",
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

interface FallbackEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  currentLineInCall?: boolean;
  breakpoints: Set<number>;
  onToggleBreakpoint: (line: number) => void;
  assemblyErrors: AssemblyError[];
  onDrop: (e: React.DragEvent) => void;
  onCursorChange?: (pos: { line: number; column: number }) => void;
  readOnly?: boolean;
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

/**
 * Phone-mode editor: bare `<textarea>` plus a synced gutter strip that
 * shows line numbers, breakpoint dots, current-PC marker, and the first
 * error line. Students on iPhone SE need to be able to toggle a
 * breakpoint, see which line their error is on, and watch the PC move
 * during step -- all without Monaco's larger virtual surface.
 */
// Vertical padding shared by gutter and textarea so the first line
// of code aligns with the first gutter button. Both elements offset by
// the same constant so the running translateY math stays simple.
const FALLBACK_PAD_Y = 12;
const FALLBACK_LINE_H = 24;
// The gutter draws a window around the scroll offset, not one button per
// line. A share link is allowed a 1 MB buffer, and 1 MB of bare newlines is
// a million lines: a million buttons committed in one synchronous render, on
// a phone, with no click required. 240 rows is 5760px of gutter, more than
// any viewport this fallback runs in (under 480px wide) can show at once,
// and the overscan keeps a flick-scroll from outrunning the scroll handler.
const FALLBACK_GUTTER_ROWS = 240;
const FALLBACK_GUTTER_OVERSCAN = 20;

function FallbackEditor({
  value,
  onChange,
  currentLine,
  currentLineInCall = false,
  breakpoints,
  onToggleBreakpoint,
  assemblyErrors,
  onDrop,
  onCursorChange,
  readOnly = false,
}: FallbackEditorProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // A comment toggle changes the controlled `value`, so the DOM selection is
  // lost on the re-render. Stash the target range and reapply it after the
  // new value lands (before paint, so the caret never visibly jumps).
  const pendingSelRef = useRef<{ start: number; end: number } | null>(null);
  const lineCount = Math.max(1, value.split("\n").length);
  const errorLines = new Set(assemblyErrors.map((e) => e.line));
  const gutterFirst = Math.max(
    0,
    Math.floor(scrollTop / FALLBACK_LINE_H) - FALLBACK_GUTTER_OVERSCAN,
  );
  const gutterRows = Math.max(0, Math.min(FALLBACK_GUTTER_ROWS, lineCount - gutterFirst));

  useLayoutEffect(() => {
    const pending = pendingSelRef.current;
    const ta = taRef.current;
    if (!pending || !ta) return;
    pendingSelRef.current = null;
    const max = ta.value.length;
    ta.setSelectionRange(Math.min(pending.start, max), Math.min(pending.end, max));
  });

  // Ctrl/Cmd + / toggles line comments on the touched lines, mirroring the
  // desktop Monaco editor's built-in commentLine. `onChange` (the parent's
  // over-cap guard) may reject a near-cap add, in which case nothing changes.
  const handleCommentToggle = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    if (!(e.ctrlKey || e.metaKey) || e.key !== "/") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const next = toggleLineComment(ta.value, ta.selectionStart, ta.selectionEnd);
    if (next.text === ta.value) return;
    pendingSelRef.current = { start: next.selStart, end: next.selEnd };
    onChange(next.text);
  };

  // Outer wrapper carries `min-h-0 overflow-hidden` so the gutter's
  // natural content height (lineCount * 24px, often well past the
  // viewport on phones) cannot expand its parent and push the rest of
  // the page off-screen. The previous version had no such guard, which
  // made the editor pane balloon to thousands of pixels and pushed the
  // header / Controls / tab strip out of view on iPhone portrait.
  return (
    <div className="h-full w-full min-h-0 overflow-hidden flex bg-[var(--bg-base)]">
      <div
        className="flex-shrink-0 w-10 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-sunken)] select-none relative"
        role="presentation"
      >
        <div
          className="absolute left-0 right-0 will-change-transform"
          style={{
            transform: `translateY(${
              FALLBACK_PAD_Y - scrollTop + gutterFirst * FALLBACK_LINE_H
            }px)`,
          }}
        >
          {Array.from({ length: gutterRows }, (_, i) => gutterFirst + i + 1).map((n) => {
            const isBreak = breakpoints.has(n);
            const isError = errorLines.has(n);
            const isCurrent = currentLine === n;
            const cls = isError
              ? "text-[var(--danger)] font-bold"
              : isBreak
              ? "text-[var(--danger)]"
              : isCurrent
              ? // Inside a libc call the marker is on the call site, not on
                // the executing instruction: same amber, without the weight.
                currentLineInCall
                ? "text-[var(--amber)] opacity-70"
                : "text-[var(--amber)] font-bold"
              : "text-[var(--text-secondary)]";
            return (
              <button
                key={n}
                type="button"
                onClick={() => onToggleBreakpoint(n)}
                className={`block w-full h-6 leading-6 text-right pr-2 text-[11px] tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cyan)] ${cls}`}
                aria-label={
                  isBreak
                    ? `line ${n}, breakpoint set, tap to clear`
                    : `line ${n}, tap to set breakpoint`
                }
              >
                {isBreak ? "●" : n}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        // caret-color keeps the phone fallback's native caret in the same
        // amber as Monaco's block cursor, so the brand cursor survives the
        // textarea downgrade.
        className="flex-1 h-full min-h-0 resize-none bg-[var(--bg-base)] text-[var(--text-primary)] [caret-color:var(--amber)] font-mono text-[16px] pl-2 pr-3 focus:outline-none leading-6 whitespace-pre"
        style={{
          WebkitAppearance: "none",
          paddingTop: `${FALLBACK_PAD_Y}px`,
          paddingBottom: `${FALLBACK_PAD_Y}px`,
          lineHeight: `${FALLBACK_LINE_H}px`,
          overflow: "auto",
        }}
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleCommentToggle}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onSelect={(e) => {
          if (!onCursorChange) return;
          const ta = e.currentTarget;
          const upto = ta.value.slice(0, ta.selectionStart);
          const lines = upto.split("\n");
          const line = lines.length;
          const column = (lines[lines.length - 1]?.length ?? 0) + 1;
          onCursorChange({ line, column });
        }}
        aria-label="assembly source"
      />
    </div>
  );
}
