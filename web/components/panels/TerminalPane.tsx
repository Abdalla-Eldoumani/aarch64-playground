"use client";

import { useCallback, useEffect, useRef } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  dispatchCommand,
  type DispatchContext,
  type TerminalForegroundProgram,
  type TerminalProgramIO,
} from "@/lib/terminal/dispatch";
import { TerminalInputState, splitPasteLines } from "@/lib/terminal/input-state";

// xterm takes literal hex only, so these restate token values from
// app/globals.css per theme — the terminal sits on --bg-base, the caret is
// the amber block cursor (the machine's color), and the ANSI ramp lands on
// the v2 syntax and status hues. Keep in step with the tokens when one moves.
const XTERM_THEMES: Record<string, ITheme> = {
  dark: {
    background: "#0B0C10",
    foreground: "#EDEEF1",
    cursor: "#FFB224",
    selectionBackground: "#3EC5E84D",
    black: "#262B33",
    red: "#FF6B6B",
    green: "#4ADE80",
    yellow: "#FFB224",
    blue: "#6FA8FF",
    magenta: "#FF7EB6",
    cyan: "#3EC5E8",
    white: "#A5ACB6",
    brightBlack: "#3A414C",
    brightRed: "#FF8A8A",
    brightGreen: "#7CE9A3",
    brightYellow: "#FFCB5E",
    brightBlue: "#9BC1FF",
    brightMagenta: "#FFA3CB",
    brightCyan: "#7CD7F0",
    brightWhite: "#EDEEF1",
  },
  light: {
    background: "#FFFFFF",
    foreground: "#14161A",
    cursor: "#A86A0F",
    selectionBackground: "#0E749033",
    black: "#14161A",
    red: "#C2362F",
    green: "#1F8A3B",
    yellow: "#A86A0F",
    blue: "#1D4ED8",
    magenta: "#BE185D",
    cyan: "#0E7490",
    white: "#C9CED6",
    brightBlack: "#565E68",
    brightRed: "#E05252",
    brightGreen: "#2FA653",
    brightYellow: "#C4841D",
    brightBlue: "#4C6FE8",
    brightMagenta: "#D64583",
    brightCyan: "#22A3C4",
    brightWhite: "#F4F5F7",
  },
  "high-contrast": {
    background: "#000000",
    foreground: "#FFFFFF",
    cursor: "#FFC247",
    selectionBackground: "#5AD7F066",
    black: "#444444",
    red: "#FF8585",
    green: "#5CF06B",
    yellow: "#FFC247",
    blue: "#8BE0FF",
    magenta: "#FFB6E6",
    cyan: "#5AD7F0",
    white: "#E6E6E6",
    brightBlack: "#777777",
    brightRed: "#FFA3A3",
    brightGreen: "#8AF598",
    brightYellow: "#FFD480",
    brightBlue: "#B3EBFF",
    brightMagenta: "#FFCCEE",
    brightCyan: "#9AE6F7",
    brightWhite: "#FFFFFF",
  },
};

function currentXtermTheme(): ITheme {
  const t = document.documentElement.getAttribute("data-theme") ?? "dark";
  return XTERM_THEMES[t] ?? XTERM_THEMES.dark;
}

export interface TerminalPaneProps {
  /** Build a fresh DispatchContext on demand (each command may snapshot state). */
  buildContext: () => DispatchContext;
  /** Optional handler for the "upload" pseudo-command (host file picker). */
  onUploadRequest?: () => void;
  /** Hands the pane's interactive-program I/O surface to the host so a
   *  raw-mode program started from the run button can self-attach; the
   *  pane deregisters it (null) on unmount. */
  onRegisterIO?: (io: TerminalProgramIO | null) => void;
}

const PROMPT = "$ ";

/**
 * xterm.js-backed shell pane. Wraps a Terminal instance, drives the
 * input state machine on key events, dispatches command lines through
 * `dispatchCommand`, and writes the result back. Lazy-loaded by page.tsx
 * so the xterm bundle only ships when the user actually opens the
 * terminal tab.
 */
export function TerminalPane({ buildContext, onUploadRequest, onRegisterIO }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const stateRef = useRef<TerminalInputState>(new TerminalInputState());
  // The running interactive program, when one owns the pane's input.
  // While set, keystrokes bypass the shell's line editing and stream to
  // the program's stdin verbatim (arrow-key CSI sequences included).
  const foregroundRef = useRef<TerminalForegroundProgram | null>(null);
  // One stable I/O surface handed to dispatch for `./name` runs; writes
  // land in this pane's xterm and survive context-builder churn.
  const terminalIORef = useRef<TerminalProgramIO>({
    write: (text: string) => termRef.current?.write(text),
    setForeground: (fg: TerminalForegroundProgram | null) => {
      foregroundRef.current = fg;
      // A program taking the pane over should also take the keyboard:
      // without focus its first frames render but keys go nowhere.
      if (fg) termRef.current?.focus();
    },
    clear: () => {
      // reset() wipes scrollback and terminal state (SGR included),
      // which is exactly what a raw-mode takeover wants.
      termRef.current?.reset();
    },
    sessionEnded: (exitCode: number | null) => {
      const t = termRef.current;
      if (!t) return;
      t.write(
        exitCode != null
          ? `\r\n[exit ${exitCode}]\r\n`
          : "\r\n[program stopped]\r\n",
      );
      t.write(PROMPT);
    },
  });

  // The context builder closes over the emulator hub, which is a new
  // object after every machine snapshot, so this prop changes identity
  // on every step and run. Route it (and the upload handler) through
  // refs so no callback below depends on it: a dependency chain from
  // these props into the init effect would dispose and recreate the
  // terminal on each machine change, destroying the scrollback
  // mid-session -- including during the terminal's own program runs.
  const buildContextRef = useRef(buildContext);
  const onUploadRequestRef = useRef(onUploadRequest);
  const onRegisterIORef = useRef(onRegisterIO);
  useEffect(() => {
    buildContextRef.current = buildContext;
    onUploadRequestRef.current = onUploadRequest;
    onRegisterIORef.current = onRegisterIO;
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
      // A rejection used to vanish into an unhandled promise: the command
      // echoed, then nothing -- no output, no error, no prompt. Whatever
      // happens, the student gets a line and their prompt back; the raw
      // detail (often internal wording) goes to the console only.
      try {
        const ctx = { ...buildContextRef.current(), terminalIO: terminalIORef.current };
        const result = await dispatchCommand(line, ctx);
        if (result.control === "clear") {
          t.clear();
          return;
        }
        writeLines(result.lines);
      } catch (err) {
        console.warn("terminal command failed:", err);
        const name = line.split(/\s+/)[0] ?? line;
        writeLines([
          `${name}: the command failed unexpectedly -- try again, or press reset`,
        ]);
      } finally {
        writePrompt();
      }
    },
    [writePrompt, writeLines],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    // Allocate xterm once per mount; teardown in cleanup.
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "var(--font-mono), JetBrains Mono, Consolas, monospace",
      fontSize: 13,
      theme: currentXtermTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    // Follow the site theme live: the switcher writes data-theme on <html>,
    // so a mutation observer keeps the terminal palette in step without a
    // React re-render (the terminal instance survives theme flips).
    const themeObserver = new MutationObserver(() => {
      term.options.theme = currentXtermTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    termRef.current = term;
    fitRef.current = fit;
    onRegisterIORef.current?.(terminalIORef.current);

    term.writeln("cpsc 355 playground -- terminal. type 'help' for commands.");
    term.write(PROMPT);

    // Keep the cursor's visible position in sync with the input state.
    const handleKey = ({ key, domEvent }: { key: string; domEvent: KeyboardEvent }) => {
      // A foreground program owns input; onData forwards it raw.
      if (foregroundRef.current) return;
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
      // Foreground program: every byte belongs to the program, escape
      // sequences included (a game reads the arrow keys as raw CSI).
      // Ctrl+C stays with the pane and cancels the run.
      const fg = foregroundRef.current;
      if (fg) {
        if (data === "") {
          term.write("^C\r\n");
          fg.cancel();
          return;
        }
        fg.pushInput(data);
        return;
      }
      // xterm fires onKey AND onData for the same keypress with the same
      // string, and special keys (arrows, Home, Delete, F-keys) arrive as
      // multi-character escape sequences. Those belong to onKey alone: fed
      // into the buffer they are invisible on screen but corrupt the
      // submitted command and scramble the scrollback on repaint.
      if (data.charCodeAt(0) === 0x1b) return;
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
      if (lines.length === 1) return;
      // Serialize the pasted commands: each must FINISH before the next
      // dispatches. Fire-and-forget ran them concurrently, so the course
      // toolchain paste (m4 > prog.s, gcc prog.s, ./prog) failed
      // deterministically -- gcc read prog.s before m4 wrote it, with
      // the errors printing in reverse causal order.
      void (async () => {
        for (let i = 1; i < lines.length; i++) {
          const submitted = s.takeSubmission();
          if (submitted) await runLine(submitted);
          if (lines[i]) s.handlePrintable(lines[i]);
          repaintInput();
        }
      })();
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
      themeObserver.disconnect();
      onRegisterIORef.current?.(null);
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
