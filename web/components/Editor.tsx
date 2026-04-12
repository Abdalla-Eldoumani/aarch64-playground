"use client";

import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useRef } from "react";
import type { AssemblyError } from "@/lib/use-emulator";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  currentLine: number | null;
  breakpoints: Set<number>;
  onToggleBreakpoint: (line: number) => void;
  assemblyErrors: AssemblyError[];
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

export function Editor({
  value,
  onChange,
  currentLine,
  breakpoints,
  onToggleBreakpoint,
  assemblyErrors,
}: EditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<string[]>([]);

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

    // assembly errors
    for (const err of assemblyErrors) {
      decorations.push({
        range: new monaco.Range(err.line, 1, err.line, 1),
        options: {
          isWholeLine: true,
          className: "error-line-highlight",
          glyphMarginClassName: "error-glyph",
          hoverMessage: { value: err.message },
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

      monaco.editor.setTheme("arm64-dark");

      // glyph margin click for breakpoints
      editor.onMouseDown((e) => {
        if (
          e.target.type ===
          monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        ) {
          const line = e.target.position?.lineNumber;
          if (line != null) {
            onToggleBreakpoint(line);
          }
        }
      });

      updateDecorations();
    },
    [onToggleBreakpoint, updateDecorations]
  );

  // re-apply decorations when they change
  const prevDepsRef = useRef({ currentLine, breakpoints, assemblyErrors });
  if (
    prevDepsRef.current.currentLine !== currentLine ||
    prevDepsRef.current.breakpoints !== breakpoints ||
    prevDepsRef.current.assemblyErrors !== assemblyErrors
  ) {
    prevDepsRef.current = { currentLine, breakpoints, assemblyErrors };
    updateDecorations();
  }

  return (
    <>
      <style>{`
        .current-line-highlight { background: rgba(96, 165, 250, 0.15) !important; }
        .current-line-glyph { background: #60a5fa; border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .breakpoint-glyph { background: #ef4444; border-radius: 50%; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
        .error-line-highlight { background: rgba(239, 68, 68, 0.15) !important; }
        .error-glyph { background: #f59e0b; border-radius: 2px; margin-left: 4px; width: 8px !important; height: 8px !important; margin-top: 6px; }
      `}</style>
      <MonacoEditor
        height="100%"
        language="arm64"
        theme="arm64-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          minimap: { enabled: false },
          glyphMargin: true,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
        }}
      />
    </>
  );
}
