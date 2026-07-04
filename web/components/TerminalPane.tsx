"use client";

import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { dispatchCommand, type DispatchContext } from "@/lib/terminal/dispatch";
import { TerminalInputState, splitPasteLines } from "@/lib/terminal/input-state";

export interface TerminalPaneProps {
  /** Build a fresh DispatchContext on demand (each command may snapshot state). */
  buildContext: () => DispatchContext;
  /** Optional handler for the "upload" pseudo-command (host file picker). */
  onUploadRequest?: () => void;
}

const PROMPT = "$ ";

/**
 * xterm.js-backed shell pane. Wraps a Terminal instance, drives the
 * input state machine on key events, dispatches command lines through
 * `dispatchCommand`, and writes the result back. Lazy-loaded by page.tsx
 * so the xterm bundle only ships when the user actually opens the
 * terminal tab.
 */
export function TerminalPane({ buildContext, onUploadRequest }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const stateRef = useRef<TerminalInputState>(new TerminalInputState());

  // The context builder closes over the emulator hub, which is a new
  // object after every machine snapshot, so this prop changes identity
  // on every step and run. Route it (and the upload handler) through
  // refs so no callback below depends on it: a dependency chain from
  // these props into the init effect would dispose and recreate the
  // terminal on each machine change, destroying the scrollback
  // mid-session -- including during the terminal's own program runs.
  const buildContextRef = useRef(buildContext);
  const onUploadRequestRef = useRef(onUploadRequest);
  useEffect(() => {
    buildContextRef.current = buildContext;
    onUploadRequestRef.current = onUploadRequest;
  });

  const writePrompt = useCallback(() => {
    termRef.current?.write(PROMPT);
  }, []);

  const repaintInput = useCallback(() => {
    const t = termRef.current;
    const s = stateRef.current;
    if (!t) return;
    // Clear the current line, rewrite prompt, then the buffer.
    t.write("\r\x1b[2K" + PROMPT + s.buffer);
  }, []);

  const writeLines = useCallback((lines: string[]) => {
    const t = termRef.current;
    if (!t) return;
    for (const line of lines) t.write(line + "\r\n");
  }, []);

  const runLine = useCallback(
    async (line: string) => {
      const t = termRef.current;
      if (!t) return;
      t.write("\r\n");
      if (line === "upload") {
        onUploadRequestRef.current?.();
        t.write("upload: pick a file in the host dialog above\r\n");
        writePrompt();
        return;
      }
      const ctx = buildContextRef.current();
      const result = await dispatchCommand(line, ctx);
      if (result.control === "clear") {
        t.clear();
        writePrompt();
        return;
      }
      writeLines(result.lines);
      writePrompt();
    },
    [writePrompt, writeLines],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    // Allocate xterm once per mount; teardown in cleanup.
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: "var(--font-mono), JetBrains Mono, Consolas, monospace",
      fontSize: 13,
      theme: {
        background: "#0e1117",
        foreground: "#dde4f0",
        cursor: "#7fb1ff",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    term.writeln("cpsc 355 playground -- terminal. type 'help' for commands.");
    term.write(PROMPT);

    // Keep the cursor's visible position in sync with the input state.
    const handleKey = ({ key, domEvent }: { key: string; domEvent: KeyboardEvent }) => {
      const s = stateRef.current;
      if (domEvent.key === "Enter") {
        const submission = s.takeSubmission();
        if (submission) void runLine(submission);
        else {
          term.write("\r\n");
          writePrompt();
        }
        return;
      }
      if (domEvent.key === "Backspace") {
        s.handleBackspace();
        repaintInput();
        return;
      }
      if (domEvent.key === "ArrowUp") {
        s.handleUp();
        repaintInput();
        return;
      }
      if (domEvent.key === "ArrowDown") {
        s.handleDown();
        repaintInput();
        return;
      }
      if (domEvent.key === "Tab") {
        domEvent.preventDefault();
        const ctx = buildContextRef.current();
        const matches = s.handleTab(ctx.listVfs());
        if (matches.length === 1) {
          repaintInput();
        } else if (matches.length > 1) {
          term.write("\r\n");
          writeLines(matches);
          writePrompt();
          term.write(s.buffer);
        }
        return;
      }
      // Printable character. xterm sends multi-byte sequences for some
      // keys (e.g. F1); ignore anything that isn't a single visible char.
      if (key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) < 0x7f) {
        s.handlePrintable(key);
        repaintInput();
      }
    };
    const sub = term.onKey(handleKey);

    // Paste support (mobile keyboards, clipboard).
    const pasteSub = term.onData((data) => {
      // Only treat multi-character data as a paste; single-char keys are
      // already handled by onKey above.
      if (data.length <= 1) return;
      const s = stateRef.current;
      // xterm delivers pasted line breaks as bare \r, never \n, so the
      // split must accept every convention or a multi-line paste lands
      // as one joined command line.
      const lines = splitPasteLines(data);
      // First chunk extends the current line; subsequent chunks each
      // submit a separate command.
      s.handlePrintable(lines[0]);
      repaintInput();
      for (let i = 1; i < lines.length; i++) {
        const submitted = s.takeSubmission();
        if (submitted) void runLine(submitted);
        if (lines[i]) s.handlePrintable(lines[i]);
        repaintInput();
      }
    });

    // Refit on container resize -- important when the parent panel
    // resizes (PanelGroup drag, mobile keyboard show/hide).
    const ro = new ResizeObserver(() => {
      try { fit.fit(); } catch { /* xterm may be torn down */ }
    });
    ro.observe(containerRef.current);

    return () => {
      sub.dispose();
      pasteSub.dispose();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // Every dependency here is a stable useCallback, so the terminal is
    // allocated exactly once per mount and survives machine re-renders.
  }, [repaintInput, runLine, writeLines, writePrompt]);

  return (
    <div
      className="h-full w-full bg-[var(--bg-base)] overflow-hidden"
      ref={containerRef}
      aria-label="shell terminal"
      role="application"
    />
  );
}
