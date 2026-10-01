"use client";

import { useCallback, useState } from "react";
import { ScrollingPre } from "@/components/ui/ScrollingPre";
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
 * Read-only code block colored by the `--syntax-*` tokens, set per theme to
 * match the editor. Code renders as text spans only, so a caller's string
 * cannot inject markup.
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

  // Under a coarse pointer the copy button is a 44px target, two code lines
  // tall, so the code starts below it rather than hiding a line's end.
  return (
    <div className={`relative ${className}`}>
      <ScrollingPre preClassName="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] [@media(pointer:coarse)]:pt-14">
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
      </ScrollingPre>
      <button
        type="button"
        onClick={copy}
        aria-label="copy code to clipboard"
        className={`touch-target absolute right-2 top-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-2 py-1 font-mono text-[12px] leading-none outline-none transition-colors focus-visible:[box-shadow:var(--ring)] ${
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
