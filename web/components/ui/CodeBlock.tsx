"use client";

import { useCallback, useState } from "react";
import { KIND_CLASS, tokenizeLine, type Token } from "@/lib/asm/highlight-arm64";

export interface CodeBlockProps {
  /** The source to render, read-only. */
  code: string;
  /** Dialect hint. "arm64" assembly is tokenized; anything else renders as
   *  plain monospaced text. */
  language?: string;
  /** Zero-based line to mark as the current line (amber left bar + tint),
   *  the debugger's current-line treatment for teaching walkthroughs. */
  highlightLine?: number;
  className?: string;
}

/**
 * Read-only syntax-colored code block. Tokenizes assembly into React spans whose
 * colors read from the `--syntax-*` tokens (defined per theme in globals.css to
 * match the editor), so the block and the editor stay visually consistent. Code
 * is rendered as text spans only (no HTML-string injection path), so a
 * caller-supplied string cannot inject markup. A corner button copies the
 * source to the clipboard in a single click.
 */
export function CodeBlock({
  code,
  language = "arm64",
  highlightLine,
  className = "",
}: CodeBlockProps) {
  const lines = code.replace(/\n$/, "").split("\n");
  const tokenizedLines =
    language === "arm64"
      ? lines.map(tokenizeLine)
      : lines.map((line): Token[] => [{ text: line, kind: "text" }]);

  const [copied, setCopied] = useState(false);
  // Insecure contexts reject the clipboard write; the label stays put rather
  // than claiming a copy that did not happen.
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard is unavailable outside a secure context; no fallback here.
    }
  }, [code]);

  return (
    <div className={`relative ${className}`}>
      <pre className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)]">
        <code>
          {tokenizedLines.map((tokens, lineIndex) => (
            <span
              key={lineIndex}
              data-current={lineIndex === highlightLine || undefined}
              className={`block min-h-[1.4em] ${
                lineIndex === highlightLine
                  ? "bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] [box-shadow:inset_3px_0_0_0_var(--amber)]"
                  : ""
              }`}
            >
              {tokens.map((token, tokenIndex) => (
                <span key={tokenIndex} className={KIND_CLASS[token.kind]}>
                  {token.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="copy code to clipboard"
        className={`absolute right-2 top-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-2 py-1 font-mono text-[10px] leading-none outline-none transition-colors focus-visible:[box-shadow:var(--ring)] ${
          copied
            ? "text-[var(--success)]"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        }`}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
