"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AssemblyError } from "@/lib/emulator/use-emulator";
import { KIND_CLASS, tokenizeLine } from "@/lib/asm/highlight-arm64";
import { toggleLineComment } from "@/lib/asm/line-comment";

export interface TouchEditorProps {
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
  /** Jump to a line (an error to fix), as Editor's prop of the same name. */
  focusRequest?: { line: number; nonce: number } | null;
  /** Follow the pc, as Editor's prop of the same name: off while a run
   *  drives and until the first step. */
  followCurrentLine?: boolean;
}

// Vertical padding shared by the gutter, the colour layer, and the textarea,
// so all three put line 1 at the same height and one offset moves them all.
const PAD_Y = 12;
const LINE_H = 24;
// The gutter and the colour layer draw a window around the scroll offset, not
// one row per line. A share link is allowed a 1 MB buffer, and 1 MB of bare
// newlines is a million lines, all committed in one render on a phone. 240
// rows is 5760px, more than any screen this editor runs on shows at once, and
// the overscan keeps a flick from outrunning the scroll handler.
const WINDOW_ROWS = 240;
const OVERSCAN = 20;

// The textarea and the colour layer under it must lay text out identically or
// the caret drifts off the letters: same face, size, line height, tab stops,
// padding, and no ligatures. Weight and slant stay regular in the layer for
// the same reason, since a bold or italic face need not share the advance.
const TEXT_METRICS =
  "font-mono text-[16px] leading-6 whitespace-pre pl-2 pr-3 [tab-size:4] [font-variant-ligatures:none]";

/**
 * The editor for touch screens (and very narrow windows): a real `<textarea>`
 * the phone's own keyboard, selection handles, and dictation all work with,
 * laid over a coloured copy of the same text. The textarea's glyphs are
 * transparent, so the student reads the coloured layer and types into the
 * native control. Beside it, a gutter of line numbers that toggle breakpoints,
 * and under both, bands for the executing line and for lines the assembler
 * rejected. Lines do not wrap; an edge fade says when a line runs past the
 * right side.
 */
export function TouchEditor({
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
  focusRequest = null,
  followCurrentLine = true,
}: TouchEditorProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [moreRight, setMoreRight] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const bandsRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  // The textarea owns the offsets, so the three layers are moved in the frame
  // of the scroll that caused it. The state write only picks which window of
  // rows the next render commits; letting it move the layers too left the
  // numbers and colours a frame behind the text.
  const paint = useCallback((top: number, left: number) => {
    const y = PAD_Y - top;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${y}px)`;
    if (bandsRef.current) bandsRef.current.style.transform = `translateY(${y}px)`;
    if (codeRef.current) codeRef.current.style.transform = `translate(${-left}px, ${y}px)`;
  }, []);
  const measureRight = useCallback(() => {
    const ta = taRef.current;
    if (ta) setMoreRight(ta.scrollWidth - ta.scrollLeft - ta.clientWidth > 1);
  }, []);
  // A comment toggle changes the controlled `value`, so the DOM selection is
  // lost on the re-render. Stash the target range and reapply it after the new
  // value lands (before paint, so the caret never visibly jumps).
  const pendingSelRef = useRef<{ start: number; end: number } | null>(null);
  const lines = value.split("\n");
  const lineCount = Math.max(1, lines.length);
  const errorLines = new Set(assemblyErrors.map((e) => e.line));
  const first = Math.max(0, Math.floor(scrollTop / LINE_H) - OVERSCAN);
  const rows = Math.max(0, Math.min(WINDOW_ROWS, lineCount - first));

  useLayoutEffect(() => {
    const pending = pendingSelRef.current;
    const ta = taRef.current;
    if (!pending || !ta) return;
    pendingSelRef.current = null;
    const max = ta.value.length;
    ta.setSelectionRange(Math.min(pending.start, max), Math.min(pending.end, max));
  });

  // A new line length can put text past the right edge, or take it away.
  useLayoutEffect(() => {
    measureRight();
  }, [value, measureRight]);

  // Follow the pc the way Monaco's revealLine does: nearest, so the buffer
  // moves only as far as it must.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || currentLine == null || !followCurrentLine) return;
    const top = PAD_Y + (currentLine - 1) * LINE_H;
    const above = top < ta.scrollTop;
    const below = top + LINE_H > ta.scrollTop + ta.clientHeight;
    if (!above && !below) return;
    const next = Math.max(0, above ? top : top + LINE_H - ta.clientHeight);
    ta.scrollTop = next;
    // The scroll event this write raises carries the new offset into state
    // and re-picks the window; this paint keeps the layers aligned meanwhile.
    paint(next, ta.scrollLeft);
  }, [currentLine, followCurrentLine, paint]);

  // Jump to an error: the line centred, the caret at its start, the focus in
  // the editor, as Monaco's revealLineInCenter does. A request already there
  // at mount is not replayed, as Monaco drops one it gets before it loads, so
  // a remount never steals the focus.
  const seenFocusRef = useRef(focusRequest?.nonce ?? null);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || !focusRequest || focusRequest.nonce === seenFocusRef.current) return;
    seenFocusRef.current = focusRequest.nonce;
    const lines = ta.value.split("\n");
    const line = Math.min(Math.max(1, focusRequest.line), lines.length);
    const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, start);
    ta.scrollTop = Math.max(0, PAD_Y + (line - 1) * LINE_H - (ta.clientHeight - LINE_H) / 2);
    ta.scrollLeft = 0;
    paint(ta.scrollTop, 0);
  }, [focusRequest, paint]);

  // Ctrl/Cmd + / toggles line comments on the touched lines, as Monaco does,
  // for a tablet with a keyboard. `onChange` (the parent's over-cap guard)
  // may reject a near-cap add, in which case nothing changes.
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

  const band = (line: number): string | null => {
    if (errorLines.has(line)) return "bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]";
    if (line !== currentLine) return null;
    // Inside a libc call the marked line is the call site, not the executing
    // word: a fainter wash and a dashed rule, as in the desktop editor.
    return currentLineInCall
      ? "bg-[color-mix(in_srgb,var(--amber)_6%,transparent)] [background-image:repeating-linear-gradient(to_bottom,var(--amber)_0_4px,transparent_4px_8px)] [background-size:2px_100%] bg-no-repeat"
      : "bg-[color-mix(in_srgb,var(--amber)_14%,transparent)] [box-shadow:inset_2px_0_0_0_var(--amber)]";
  };
  const shown = Array.from({ length: rows }, (_, i) => first + i + 1);

  // The outer box is `min-h-0 overflow-hidden` so the layers' natural height
  // (every line at 24px) cannot grow the pane and push the rest of the
  // playground off a phone screen.
  return (
    <div className="h-full w-full min-h-0 overflow-hidden flex bg-[var(--bg-base)]">
      <div
        className="flex-shrink-0 w-11 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-sunken)] select-none relative"
        role="presentation"
      >
        <div
          ref={gutterRef}
          className="absolute left-0 right-0 will-change-transform"
          style={{
            // Scroll and window are split across two properties so the
            // scroll half can be written imperatively without fighting this
            // render.
            transform: `translateY(${PAD_Y - scrollTop}px)`,
            paddingTop: `${first * LINE_H}px`,
          }}
        >
          {shown.map((n) => {
            const isBreak = breakpoints.has(n);
            const isError = errorLines.has(n);
            const isCurrent = currentLine === n;
            const cls = isError
              ? "text-[var(--danger)] font-bold"
              : isBreak
                ? "text-[var(--danger)]"
                : isCurrent
                  ? currentLineInCall
                    ? "text-[var(--amber)] opacity-70"
                    : "text-[var(--amber)] font-bold"
                  : "text-[var(--text-secondary)]";
            return (
              <button
                key={n}
                type="button"
                data-line-toggle=""
                onClick={() => onToggleBreakpoint(n)}
                className={`block w-full h-6 leading-6 text-right pr-2 text-[12px] tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cyan)] ${cls}`}
                aria-label={
                  isBreak ? `line ${n}, breakpoint set, tap to clear` : `line ${n}, tap to set breakpoint`
                }
              >
                {isBreak ? "●" : n}
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
        <div
          ref={bandsRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0 will-change-transform"
          style={{ transform: `translateY(${PAD_Y - scrollTop}px)` }}
        >
          {shown.map((n) => {
            const cls = band(n);
            return cls ? (
              <div
                key={n}
                className={`absolute left-0 right-0 h-6 ${cls}`}
                style={{ top: `${(n - 1) * LINE_H}px` }}
              />
            ) : null;
          })}
        </div>
        <pre
          ref={codeRef}
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 m-0 min-w-full text-[var(--text-primary)] will-change-transform [&_span]:font-normal [&_span]:not-italic ${TEXT_METRICS}`}
          style={{
            transform: `translate(0px, ${PAD_Y - scrollTop}px)`,
            paddingTop: `${first * LINE_H}px`,
          }}
        >
          {shown.map((n) => (
            <div key={n} className="h-6">
              {tokenizeLine(lines[n - 1] ?? "").map((token, i) => (
                <span key={i} className={KIND_CLASS[token.kind]}>
                  {token.text}
                </span>
              ))}
            </div>
          ))}
        </pre>
        <textarea
          ref={taRef}
          // The glyphs are transparent so the coloured layer shows through;
          // the caret keeps the amber of Monaco's block cursor.
          className={`absolute inset-0 h-full w-full resize-none bg-transparent text-transparent [-webkit-text-fill-color:transparent] [caret-color:var(--amber)] selection:bg-[color-mix(in_srgb,var(--cyan)_30%,transparent)] focus:outline-none ${TEXT_METRICS}`}
          style={{
            WebkitAppearance: "none",
            paddingTop: `${PAD_Y}px`,
            paddingBottom: `${PAD_Y}px`,
            lineHeight: `${LINE_H}px`,
            overflow: "auto",
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleCommentToggle}
          readOnly={readOnly}
          // Phones would otherwise capitalise the first letter of every line
          // and "correct" mnemonics into words.
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onScroll={(e) => {
            const { scrollTop: top, scrollLeft: left } = e.currentTarget;
            paint(top, left);
            setScrollTop(top);
            measureRight();
          }}
          onSelect={(e) => {
            if (!onCursorChange) return;
            const ta = e.currentTarget;
            const upto = ta.value.slice(0, ta.selectionStart).split("\n");
            onCursorChange({ line: upto.length, column: (upto[upto.length - 1]?.length ?? 0) + 1 });
          }}
          aria-label="assembly source"
        />
        {moreRight && (
          // Lines run past the right edge; the fade says so without taking
          // any width from the code.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--bg-base)] to-transparent"
          />
        )}
      </div>
    </div>
  );
}
