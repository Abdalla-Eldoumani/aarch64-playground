"use client";

import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssemblyError } from "@/lib/use-emulator";
import { lookupDoc } from "@/lib/instruction-docs";
import { explainError } from "@/lib/error-explain";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  breakpoints: Set<number>;
  onToggleBreakpoint: (line: number) => void;
  assemblyErrors: AssemblyError[];
  onCursorChange?: (pos: { line: number; column: number }) => void;
}

const ARM64_MNEMONICS = [
  "MOV", "MOVZ", "MOVK", "MOVN",
  "ADD", "ADDS", "SUB", "SUBS", "MUL", "UDIV", "SDIV", "NEG",
  "AND", "ANDS", "ORR", "EOR", "MVN", "TST",
  "LSL", "LSR", "ASR", "ROR",
  "CMP", "CMN",
  "LDR", "STR", "LDRB", "STRB", "LDRH", "STRH", "LDP", "STP",
  "B", "BL", "BR", "BLR", "RET",
  "CSEL", "CSINC", "CSET",
  "NOP", "SVC",
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

function isNarrow(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 480;
}

export function Editor({
  value,
  onChange,
  currentLine,
  breakpoints,
  onToggleBreakpoint,
  assemblyErrors,
  onCursorChange,
}: EditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const [fallback, setFallback] = useState<boolean>(() => isNarrow());

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

    // current line highlight
    if (currentLine != null) {
      decorations.push({
        range: new monaco.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: "current-line-highlight",
          glyphMarginClassName: "current-line-glyph",
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
  }, [currentLine, breakpoints, assemblyErrors]);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // register ARM64 language
      monaco.languages.register({ id: "arm64" });
      monaco.languages.setMonarchTokensProvider("arm64", {
        ignoreCase: true,
        tokenizer: {
          root: [
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
        },
      });

      monaco.editor.defineTheme("arm64-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "keyword", foreground: "60a5fa", fontStyle: "bold" },
          { token: "variable", foreground: "f472b6" },
          { token: "number", foreground: "a78bfa" },
          { token: "number.hex", foreground: "a78bfa" },
          { token: "comment", foreground: "6b7280", fontStyle: "italic" },
          { token: "type.identifier", foreground: "34d399" },
        ],
        colors: {
          "editor.background": "#0f1117",
          "editor.lineHighlightBackground": "#1a1d2788",
          "editorGutter.background": "#0f1117",
          "editorLineNumber.foreground": "#4b5563",
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
          "editor.background": "#ffffff",
          "editor.lineHighlightBackground": "#f1f5f988",
          "editorGutter.background": "#ffffff",
          "editorLineNumber.foreground": "#6b7280",
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
          "editor.lineHighlightBackground": "#1a1a1a",
          "editorGutter.background": "#000000",
          "editorLineNumber.foreground": "#d1d5db",
        },
      });

      const applyTheme = () => {
        const t = document.documentElement.getAttribute("data-theme");
        const id = t === "light" ? "arm64-light" : t === "high-contrast" ? "arm64-hc" : "arm64-dark";
        monaco.editor.setTheme(id);
      };
      applyTheme();
      const observer = new MutationObserver(applyTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
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
            `**${word.word.toUpperCase()}** — ${doc.summary}`,
          ];
          if (doc.details) {
            lines.push("", ...doc.details);
          }
          if (doc.example) {
            lines.push("", "```", doc.example, "```");
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
        }
      }

      updateDecorations();
    },
    [onToggleBreakpoint, updateDecorations]
  );

  // re-apply decorations when the editor or any of its inputs change
  useEffect(() => {
    updateDecorations();
  }, [currentLine, breakpoints, assemblyErrors, updateDecorations]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!/\.(s|asm|txt)$/i.test(file.name)) return;
      e.preventDefault();
      file.text().then((text) => onChange(text));
    },
    [onChange],
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
      onChange={onChange}
      currentLine={currentLine}
      breakpoints={breakpoints}
      onToggleBreakpoint={onToggleBreakpoint}
      assemblyErrors={assemblyErrors}
      onDrop={onDrop}
      onCursorChange={onCursorChange}
    />;
  }

  return (
    <div
      className="h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <style>{`
        .current-line-highlight { background: rgba(96, 165, 250, 0.15) !important; }
        .current-line-glyph { background: #60a5fa; border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .breakpoint-glyph { background: #ef4444; border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .error-line-highlight { background: rgba(239, 68, 68, 0.15) !important; }
        .error-glyph { background: #f59e0b; border-radius: 2px; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        @media (pointer: coarse) {
          .monaco-editor .glyph-margin { width: 32px !important; }
        }
      `}</style>
      <MonacoEditor
        height="100%"
        language="arm64"
        theme="arm64-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          // 16px font on mobile kills iOS's focus-zoom behavior; keep
          // 14 on desktop where the ems cost is worth it.
          fontSize: isCoarsePointer() ? 16 : 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          minimap: { enabled: false },
          glyphMargin: true,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          wordWrap: isCoarsePointer() ? "on" : "off",
          accessibilitySupport: "auto",
          accessibilityHelpUrl: "/docs/accessibility",
        }}
      />
    </div>
  );
}

interface FallbackEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  breakpoints: Set<number>;
  onToggleBreakpoint: (line: number) => void;
  assemblyErrors: AssemblyError[];
  onDrop: (e: React.DragEvent) => void;
  onCursorChange?: (pos: { line: number; column: number }) => void;
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

function FallbackEditor({
  value,
  onChange,
  currentLine,
  breakpoints,
  onToggleBreakpoint,
  assemblyErrors,
  onDrop,
  onCursorChange,
}: FallbackEditorProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const lineCount = Math.max(1, value.split("\n").length);
  const errorLines = new Set(assemblyErrors.map((e) => e.line));

  // Outer wrapper carries `min-h-0 overflow-hidden` so the gutter's
  // natural content height (lineCount * 24px, often well past the
  // viewport on phones) cannot expand its parent and push the rest of
  // the page off-screen. The previous version had no such guard, which
  // made the editor pane balloon to thousands of pixels and pushed the
  // header / Controls / tab strip out of view on iPhone portrait.
  return (
    <div className="h-full w-full min-h-0 overflow-hidden flex bg-[var(--bg-primary)]">
      <div
        className="flex-shrink-0 w-10 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-secondary)] select-none relative"
        role="presentation"
      >
        <div
          className="absolute left-0 right-0 will-change-transform"
          style={{ transform: `translateY(${FALLBACK_PAD_Y - scrollTop}px)` }}
        >
          {Array.from({ length: lineCount }, (_, i) => i + 1).map((n) => {
            const isBreak = breakpoints.has(n);
            const isError = errorLines.has(n);
            const isCurrent = currentLine === n;
            const cls = isError
              ? "text-[var(--danger)] font-bold"
              : isBreak
              ? "text-[var(--danger)]"
              : isCurrent
              ? "text-[var(--accent)] font-bold"
              : "text-[var(--text-secondary)]";
            return (
              <button
                key={n}
                type="button"
                onClick={() => onToggleBreakpoint(n)}
                className={`block w-full h-6 leading-6 text-right pr-2 text-[11px] tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${cls}`}
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
        className="flex-1 h-full min-h-0 resize-none bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-[16px] pl-2 pr-3 focus:outline-none leading-6 whitespace-pre"
        style={{
          WebkitAppearance: "none",
          paddingTop: `${FALLBACK_PAD_Y}px`,
          paddingBottom: `${FALLBACK_PAD_Y}px`,
          lineHeight: `${FALLBACK_LINE_H}px`,
          overflow: "auto",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
