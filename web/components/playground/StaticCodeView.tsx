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
 * The hero's code without Monaco: it server-renders, so the code is in the
 * first HTML. Sizes match Editor.tsx, not CodeBlock's 13px, so the hero keeps
 * its layout. Code renders as text spans, so a program cannot inject markup.
 */
export function StaticCodeView({ value, currentLine }: StaticCodeViewProps) {
  const lines = value.replace(/\n$/, "").split("\n");
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);

  // Follow the pc the way the editor does: the nearest scroll, and only when
  // the line is out of view, so a program that fits never moves. The box's
  // own scrollTop is written rather than calling scrollIntoView, which also
  // scrolls the page: on a phone the autoplay yanked a reader who had
  // scrolled past the hero back up to it every half second.
  useEffect(() => {
    const box = boxRef.current;
    const line = activeRef.current;
    if (!box || !line) return;
    const top = line.offsetTop;
    const bottom = top + line.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [currentLine]);

  return (
    // `relative` makes this box the lines' offsetParent, so their offsetTop
    // is measured from the top of the scrolled content.
    <div ref={boxRef} className="relative h-full w-full min-h-0 overflow-auto bg-[var(--bg-base)]">
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
