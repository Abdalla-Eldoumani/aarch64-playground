"use client";

import MonacoEditor from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { compileCToAsm } from "@/lib/godbolt";
import { filterAssembly, looksRunnable } from "@/lib/asm-filter";

const DEFAULT_C = `// edit, the compiler runs on save
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`;

const C_SNIPPETS: Array<{ name: string; body: string }> = [
  {
    name: "factorial (recursive)",
    body: `int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`,
  },
  {
    name: "factorial (iterative)",
    body: `int factorial(int n) {
    int r = 1;
    for (int i = 2; i <= n; i++) r *= i;
    return r;
}
`,
  },
  {
    name: "add",
    body: `int add(int a, int b) {
    return a + b;
}
`,
  },
  {
    name: "array sum",
    body: `int sum(const int *a, int n) {
    int s = 0;
    for (int i = 0; i < n; i++) s += a[i];
    return s;
}
`,
  },
  {
    name: "struct field",
    body: `struct point { int x; int y; };
int ysum(const struct point *pts, int n) {
    int s = 0;
    for (int i = 0; i < n; i++) s += pts[i].y;
    return s;
}
`,
  },
  {
    name: "switch",
    body: `int pick(int k) {
    switch (k) {
        case 0: return 10;
        case 1: return 20;
        case 2: return 30;
        default: return -1;
    }
}
`,
  },
  {
    name: "hello printf",
    body: `#include <stdio.h>
int main(void) {
    printf("hello %d\\n", 42);
    return 0;
}
`,
  },
];

const OPT_LEVELS = ["-O0", "-O1", "-O2", "-Os"];

/**
 * Build a godbolt.org URL that reopens the current C snippet on their
 * web UI using the same AArch64 compiler and flags the playground uses.
 * Uses the classic-query parameters (`?source=&compiler=&flags=`) rather
 * than the shortener API so it works without an extra server round
 * trip; Compiler Explorer handles the rest.
 */
function buildGodboltUrl(source: string, optLevel: string): string {
  const base = "https://godbolt.org/";
  const flags = [
    optLevel,
    "-S",
    "-fno-asynchronous-unwind-tables",
    "-fno-stack-protector",
    "-fno-PIE",
    "-fno-pic",
    "-march=armv8-a",
  ].join(" ");
  const params = new URLSearchParams({
    source,
    compiler: "cgnat1220",
    flags,
  });
  return `${base}?${params.toString()}`;
}

export interface CToAsmViewProps {
  onLoadIntoPlayground: (asm: string) => void;
  onClose: () => void;
}

export function CToAsmView({ onLoadIntoPlayground, onClose }: CToAsmViewProps) {
  const [csource, setCsource] = useState(DEFAULT_C);
  const [asm, setAsm] = useState<string>("");
  const [sourceMap, setSourceMap] = useState<(number | null)[]>([]);
  const [optLevel, setOptLevel] = useState("-O0");
  const [filter, setFilter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [asmCursorLine, setAsmCursorLine] = useState<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compile = useCallback(
    async (source: string, opt: string) => {
      if (!source.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const res = await compileCToAsm(source, opt);
        setAsm(res.asm);
        setCached(res.cached);
        setSourceMap(res.sourceMap ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Debounce a compile-on-edit by 500ms so every keystroke doesn't hit
  // the upstream API. The explicit "compile" button calls `compile`
  // directly, bypassing the debounce.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      compile(csource, optLevel);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [csource, optLevel, compile]);

  const displayed = asm ? filterAssembly(asm, { filterDirectives: filter }) : "";
  const canLoad = displayed.trim().length > 0 && looksRunnable(displayed);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="text-xs text-[var(--text-primary)] font-semibold">
          C to AArch64
        </span>
        <select
          value={optLevel}
          onChange={(e) => setOptLevel(e.target.value)}
          aria-label="optimization level"
          className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
        >
          {OPT_LEVELS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={filter}
            onChange={(e) => setFilter(e.target.checked)}
          />
          filter directives
        </label>
        <select
          defaultValue=""
          onChange={(e) => {
            const snip = C_SNIPPETS.find((s) => s.name === e.target.value);
            if (snip) setCsource(snip.body);
            e.target.value = "";
          }}
          aria-label="load c snippet"
          className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
        >
          <option value="" disabled>
            snippet...
          </option>
          {C_SNIPPETS.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => compile(csource, optLevel)}
          className="text-xs text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded px-2 py-1"
        >
          compile
        </button>
        <button
          type="button"
          disabled={!canLoad}
          onClick={() => onLoadIntoPlayground(displayed)}
          className="text-xs text-[var(--text-primary)] bg-[var(--accent-muted)] hover:bg-[var(--accent)] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed rounded px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          load into playground
        </button>
        <a
          href={buildGodboltUrl(csource, optLevel)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] underline-offset-2 hover:underline rounded px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="open this snippet on compiler explorer"
        >
          open on godbolt
        </a>
        <div className="flex-1" />
        {cached && (
          <span className="text-[10px] text-[var(--text-secondary)]">cached</span>
        )}
        {busy && (
          <span className="text-[10px] text-[var(--accent)]">compiling...</span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="close c-to-asm view"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          close
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-1 text-xs text-[var(--danger)] border-b border-[var(--border)] bg-[var(--bg-secondary)]"
        >
          {error}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex-1 min-h-0 border-b md:border-b-0 md:border-r border-[var(--border)]">
          <MonacoEditor
            height="100%"
            language="c"
            value={csource}
            onChange={(v) => setCsource(v ?? "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              scrollBeyondLastLine: false,
            }}
          />
        </div>
        <div className="flex-1 min-h-0 relative">
          <MonacoEditor
            height="100%"
            language="asm"
            value={displayed}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "off",
              scrollBeyondLastLine: false,
            }}
            onMount={(editor) => {
              editor.onDidChangeCursorPosition((e) => {
                setAsmCursorLine(e.position.lineNumber);
              });
            }}
          />
          {sourceMap.length > 0 && asmCursorLine > 0 && sourceMap[asmCursorLine - 1] != null && (
            <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] pointer-events-none">
              C line: {sourceMap[asmCursorLine - 1]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
