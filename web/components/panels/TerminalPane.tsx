"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  dispatchCommand,
  fitTable,
  type DispatchContext,
  type TerminalForegroundProgram,
  type TerminalProgramIO,
} from "@/lib/terminal/dispatch";
import { TerminalInputState, splitPasteLines } from "@/lib/terminal/input-state";
import { isThemeId } from "@/lib/theme/themes";
import { xtermTheme } from "@/lib/theme/editor-themes";
import { useStoredSetting } from "@/lib/hooks/use-stored-setting";

// With no known data-theme the page paints dark, so the terminal does too.
function currentXtermTheme(): ITheme {
  const t = document.documentElement.getAttribute("data-theme");
  return xtermTheme(isThemeId(t) ? t : "dark");
}

// xterm sizes its cells on a canvas, which cannot read a CSS variable: given
// `var(--font-mono)` it measured 10px Arial, and padded every glyph out to that
// width, so a laptop pane held 62 columns where 75 fit. The variable (set in
// app/layout.tsx) is resolved here first, as the editor does. Measured by
// name, a row is the font's own height, which already clears descenders.
function monoFontFamily(): string {
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return `${mono ? `${mono}, ` : ""}"JetBrains Mono", Consolas, monospace`;
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

// The playground's run keys pass through to the page, which runs them: no
// terminal example reads F5, F6, F9 or F10, and Ctrl+Enter only repeats Enter.
function isPlaygroundKey(e: KeyboardEvent): boolean {
  if (e.key === "F5" || e.key === "F6" || e.key === "F9" || e.key === "F10") return true;
  return (e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "F8");
}

// Ctrl+M leaves the terminal, so the keyboard is never trapped in it. A
// program reads it as the same byte as Enter, which it still gets from Enter.
function isLeaveKey(e: KeyboardEvent): boolean {
  return e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === "m";
}

// The text size is a scale of the 13px default, kept per viewer in the
// panels' zoom family: 60% to 180% in tenths, anything else read as 100%.
const ZOOM_KEY = "aarch64-playground:zoom:terminal";
function parseZoom(raw: string | null): number {
  const scale = Number(raw);
  return scale >= 0.6 && scale <= 1.8 ? scale : 1;
}

// The bottom line's controls stay one 16px line on a mouse, so full screen
// keeps the rows a game needs; a touch screen gets 44px targets.
const CONTROL =
  "touch-target h-4 px-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:[box-shadow:var(--ring)]";

/**
 * The xterm.js shell pane. lazy-panels.tsx loads it on demand so the xterm
 * bundle ships only when the student opens the terminal tab.
 */
export function TerminalPane({ buildContext, onUploadRequest, onRegisterIO }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveHintId = useId();
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const stateRef = useRef<TerminalInputState>(new TerminalInputState());
  // The running interactive program, when one owns the pane's input.
  // While set, keystrokes bypass the shell's line editing and stream to
  // the program's stdin verbatim (arrow-key CSI sequences included).
  const foregroundRef = useRef<TerminalForegroundProgram | null>(null);
  // Full screen, read by the key handlers the terminal was built with, and
  // where the focus goes back when it ends.
  const fullRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The text size the next fit uses, and that fit, once the terminal exists.
  const scaleRef = useRef(1);
  const refitRef = useRef<(() => void) | null>(null);
  // One stable I/O surface handed to dispatch for `./name` runs; writes
  // land in this pane's xterm and survive context-builder churn.
  const terminalIORef = useRef<TerminalProgramIO>({
    write: (text: string) => termRef.current?.write(text),
    setForeground: (fg: TerminalForegroundProgram | null) => {
      foregroundRef.current = fg;
      const t = termRef.current;
      if (!fg || !t) return;
      // A program taking the pane over should also take the keyboard:
      // without focus its first frames render but keys go nowhere.
      t.focus();
      // And it learns the pane's size now; onResize below sends each change.
      fg.resize(t.cols, t.rows);
    },
    clear: () => {
      // reset() wipes scrollback and terminal state (SGR included),
      // which is exactly what a raw-mode takeover wants.
      termRef.current?.reset();
    },
    focus: () => termRef.current?.focus(),
    altScreen: () => termRef.current?.buffer.active.type === "alternate",
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

  // buildContext is a new function after every step and run. Refs keep these
  // props out of the init effect's dependencies, which would otherwise rebuild
  // the terminal on each step and wipe its scrollback mid-session.
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
        t.write("upload: choose a file in the window that opened\r\n");
        writePrompt();
        return;
      }
      // An unhandled rejection would leave the command echoed and nothing
      // else: no output, no error, no prompt. Whatever happens, the student
      // gets a line and their prompt back; the raw detail (often internal
      // wording) goes to the console only.
      try {
        const ctx = { ...buildContextRef.current(), terminalIO: terminalIORef.current };
        const result = await dispatchCommand(line, ctx);
        if (result.control === "clear") {
          t.clear();
          return;
        }
        writeLines(result.table ? fitTable(result.lines, t.cols) : result.lines);
      } catch (err) {
        console.warn("terminal command failed:", err);
        const name = line.split(/\s+/)[0] ?? line;
        writeLines([
          `${name}: the command failed. run it again, or press reset to start over`,
        ]);
      } finally {
        writePrompt();
      }
    },
    [writePrompt, writeLines],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      convertEol: true,
      // A reader who asks for reduced motion gets a steady caret, as the
      // editor's does.
      cursorBlink: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      cursorStyle: "block",
      fontFamily: monoFontFamily(),
      fontSize: 13,
      theme: currentXtermTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    // Full-screen programs draw for an 80-column terminal. At the default
    // size a pane too narrow for 80 columns at 13px drops to 12px, the
    // smallest text the site uses; a size the student picked holds.
    const fitColumns = () => {
      const size = Math.round(13 * scaleRef.current);
      term.options.fontSize = size;
      const at = fit.proposeDimensions();
      if (size === 13 && at && at.cols < 80) term.options.fontSize = 12;
      fit.fit();
    };
    fitColumns();
    // Screen readers hear the way out on entering, as they do in the editor.
    term.textarea?.setAttribute("aria-describedby", leaveHintId);
    term.attachCustomKeyEventHandler((e) => {
      // Full screen without the browser's own takes Esc as the browser's
      // does: the page hears it and leaves, the program does not.
      if (e.key === "Escape" && fullRef.current && !document.fullscreenElement) return false;
      if (isLeaveKey(e)) {
        if (e.type === "keydown") {
          e.preventDefault();
          term.blur();
        }
        return false;
      }
      // false: xterm leaves the key alone, so it reaches the page's handler.
      return !isPlaygroundKey(e);
    });

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

    term.writeln("AArch64 Playground terminal. type 'help' for commands.");
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
    const resizeSub = term.onResize(({ cols, rows }) => foregroundRef.current?.resize(cols, rows));

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
      // xterm fires both onKey and onData for the same keypress with the same
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
      // Serialize the pasted commands: each must finish before the next
      // dispatches. Fire-and-forget ran them concurrently, so the course
      // toolchain paste (m4 > prog.s, gcc prog.s, ./prog) failed
      // deterministically: gcc read prog.s before m4 wrote it, with
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

    // Refit on container resize, which the parent panel does when it
    // resizes (PanelGroup drag, mobile keyboard show/hide), and on a new
    // text size.
    const refit = () => {
      // A hidden pane (the tab strip keeps a live session mounted behind
      // `display:none`) reports no layout box, and the fit addon would
      // read the computed "100%" as 100px and resize the live buffer to
      // a few columns, reflowing the running program's screen. Only fit
      // a pane that is actually on screen.
      const el = containerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
      try { fitColumns(); } catch { /* xterm may be torn down */ }
    };
    refitRef.current = refit;
    const ro = new ResizeObserver(refit);
    ro.observe(containerRef.current);

    return () => {
      sub.dispose();
      resizeSub.dispose();
      pasteSub.dispose();
      ro.disconnect();
      themeObserver.disconnect();
      onRegisterIORef.current?.(null);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      refitRef.current = null;
    };
    // Every dependency here is a stable useCallback, so the terminal is
    // allocated exactly once per mount and survives machine re-renders.
  }, [repaintInput, runLine, writeLines, writePrompt, leaveHintId]);

  const [zoom, saveZoom] = useStoredSetting(ZOOM_KEY, parseZoom);
  const stepZoom = (by: number) =>
    saveZoom(String(Math.min(1.8, Math.max(0.6, Math.round((zoom + by) * 10) / 10))));
  useEffect(() => {
    scaleRef.current = zoom;
    refitRef.current?.();
  }, [zoom]);

  const [full, setFull] = useState(false);
  // Leaving puts the pane back in its slot (the refit hands a running program
  // its old size) and the focus back where it was before full screen.
  const leaveFull = useCallback(() => {
    if (!fullRef.current) return;
    fullRef.current = false;
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    returnFocusRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = null;
  }, []);
  const toggleFull = () => {
    if (fullRef.current) return leaveFull();
    fullRef.current = true;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFull(true);
    // The page's full screen with the pane drawn over it, not the pane's
    // own: a layout crossing moves the pane's node, which ends an element's
    // full screen. Without the API (iPhone Safari) the pane fills the window.
    void document.documentElement.requestFullscreen?.().catch(() => {});
    termRef.current?.focus();
  };
  useEffect(() => {
    // The browser's own way out (Esc) ends the page's full screen.
    const follow = () => {
      if (!document.fullscreenElement) leaveFull();
    };
    document.addEventListener("fullscreenchange", follow);
    return () => {
      document.removeEventListener("fullscreenchange", follow);
      // A pane unmounted in full screen (a crossing into the phone layout)
      // hands the screen back.
      if (fullRef.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [leaveFull]);
  useEffect(() => {
    if (!full) return;
    // Ctrl+M leaves xterm for the page's body, behind the pane, where Tab
    // would walk the covered page: Tab lands on the pane's first control,
    // Shift+Tab on its last. Any other focus (an open dialog traps Tab
    // itself) and a pane hidden behind another tab leave Tab alone.
    const back = (e: KeyboardEvent) => {
      const root = rootRef.current;
      const onBody = !document.activeElement || document.activeElement === document.body;
      if (e.key !== "Tab" || !root || !onBody || root.clientWidth === 0) return;
      const controls = root.querySelectorAll<HTMLElement>("button");
      e.preventDefault();
      controls[e.shiftKey ? controls.length - 1 : 0]?.focus();
    };
    document.addEventListener("keydown", back);
    return () => document.removeEventListener("keydown", back);
  }, [full]);
  const pct = Math.round(zoom * 100);

  // The padding sits on a wrapper: the fit addon sizes the grid from the
  // terminal's parent box, which would count padding of its own as columns.
  // The hint stays put rather than showing on focus, since a pane that
  // changed height on focus would reflow the running program's screen.
  // In full screen the pane is drawn over the page's chrome (z-10) and under
  // its dialogs (z-50), so one a shortcut opens still shows.
  return (
    <div
      ref={rootRef}
      className={`flex h-full w-full flex-col bg-[var(--bg-base)]${full ? " fixed inset-0" : ""}`}
      style={full ? { zIndex: 45 } : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && fullRef.current && !document.fullscreenElement) leaveFull();
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden pl-2 pt-1">
        <div
          className="h-full w-full overflow-hidden"
          ref={containerRef}
          aria-label="shell terminal"
          role="application"
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] px-2 py-0.5 font-mono text-[12px] leading-4">
        <p id={leaveHintId} className="text-[var(--text-tertiary)] [@media(pointer:coarse)]:hidden">
          <kbd className="font-mono text-[var(--text-secondary)]">Ctrl+M</kbd>, then Tab, leaves the terminal
        </p>
        <div className="ml-auto flex items-center">
          <button type="button" aria-pressed={full} onClick={toggleFull} className={CONTROL}>
            full screen
          </button>
          <div role="group" aria-label="zoom" className="flex items-center">
            <button type="button" aria-label="zoom out" onClick={() => stepZoom(-0.1)} className={CONTROL}>
              -
            </button>
            <button
              type="button"
              aria-label={`reset zoom (currently ${pct} percent)`}
              onClick={() => saveZoom("1")}
              className={CONTROL}
            >
              {pct}%
            </button>
            <button
              type="button"
              aria-label="zoom in"
              onClick={() => stepZoom(0.1)}
              // Full screen covers the page, so Tab off the last control goes
              // back to the terminal instead of to a control no one can see.
              onKeyDown={(e) => {
                if (full && e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  termRef.current?.focus();
                }
              }}
              className={CONTROL}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
