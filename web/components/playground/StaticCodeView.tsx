"use client";

import { useEffect, useRef } from "react";
import { KIND_CLASS, tokenizeLine } from "@/lib/asm/highlight-arm64";

export interface StaticCodeViewProps {
  /** The source to render. Never edited: this view has no input path. */
  value: string;
  /**
   * The executing line, ONE-BASED, straight from the hub (`emu.currentLine`),
   * matching Monaco's line numbering rather than CodeBlock's zero-based
   * `highlightLine`. Null while nothing is loaded.
   */
  currentLine: number | null;
}

/**
 * A read-only, syntax-colored, current-line-marked view of one program with a
 * line-number gutter: everything the landing hero showed through Monaco, and
 * none of Monaco. It server-renders, so the hero's code text is in the initial
 * HTML rather than a placeholder a client-side chain has to replace.
 *
 * The metrics are pinned to the editor's, not inherited: 14px text on a 21px
 * line (`--type-code` in globals.css, `fontSize: 14` in Editor.tsx), the
 * resolved `--font-mono` stack that `.font-mono` carries, and a 40px gutter
 * matching Monaco's `lineNumbersMinChars: 3` plus its glyph margin. Reusing
 * CodeBlock's 13px would reflow the hero. The current-line treatment restates
 * Editor.tsx's, a 14% amber wash behind a 2px amber left rule, rather than
 * CodeBlock's quieter 10% and 3px.
 *
 * Code renders as text spans only, with no HTML-string path, so a
 * caller-supplied program cannot inject markup.
 */
export function StaticCodeView({ value, currentLine }: StaticCodeViewProps) {
  const lines = value.replace(/\n$/, "").split("\n");
  const activeRef = useRef<HTMLSpanElement>(null);

  // Follow the pc the way the editor does. `block: "nearest"` scrolls only when
  // the line is actually out of view, so a program that fits never jumps.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentLine]);

  return (
    <div className="h-full w-full min-h-0 overflow-auto bg-[var(--bg-base)]">
      <pre className="min-w-full font-mono text-[14px] leading-[21px] text-[var(--text-primary)]">
        <code>
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const isCurrent = lineNumber === currentLine;
            return (
              <span
                key={index}
                ref={isCurrent ? activeRef : undefined}
                data-line={lineNumber}
                data-current={isCurrent || undefined}
                className={`flex min-h-[21px] ${
                  isCurrent
                    ? "bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] [box-shadow:inset_2px_0_0_0_var(--amber)]"
                    : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-10 shrink-0 select-none pr-3 text-right tabular-nums text-[var(--text-tertiary)]"
                >
                  {lineNumber}
                </span>
                <span className="min-w-0 whitespace-pre pr-4">
                  {tokenizeLine(line).map((token, tokenIndex) => (
                    <span key={tokenIndex} className={KIND_CLASS[token.kind]}>
                      {token.text}
                    </span>
                  ))}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
