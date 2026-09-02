"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { TerminalProgramIO } from "@/lib/terminal/dispatch";
import type { LaunchMode } from "@/lib/playground/playground-handoff";
import { validateStdin } from "@/lib/playground/upload-guard";

/** The slice of the emulator hub a foreground session drives. */
export type TerminalDriveMachine = {
  stdout: string;
  isRunning: boolean;
  isHalted: boolean;
  blocked: boolean;
  programLoaded: boolean;
  wantsTerminal: boolean;
  error: string | null;
  exitCode: number | null;
  run: () => void;
  pause: () => void;
  reset: () => void;
  clearConsole: () => void;
  pushStdin: (text: string) => void;
  setOutputTap: (tap: ((text: string) => void) | null) => void;
  setSnapshotsPaused: (paused: boolean) => void;
};

export type TerminalDrive = {
  /** Where in the console's stdout a terminal-owned session began, or null
   *  when no session has taken this program over (every classic run). */
  terminalOwnedFrom: number | null;
  /** A foreground session owns the pane right now. */
  foregroundLive: boolean;
  /** Drop the console's watermark: assemble, a program handoff, and both
   *  console-emptying actions all leave it describing bytes that are gone. */
  dropTerminalWatermark: () => void;
  /** Reset the machine, watermark included. */
  resetMachine: () => void;
  /** Clear the console, watermark included. */
  clearConsoleAll: () => void;
  /** Ask for a terminal-pane run; honoured once the pane registers its io. */
  requestTerminalRun: () => void;
  /** The pane registers its io surface here, and deregisters with null. */
  registerTermIO: (io: TerminalProgramIO | null) => void;
  /** The shared drive itself, for the `./name` path that owns its own exit. */
  driveForeground: (
    io: TerminalProgramIO,
    opts?: { clearAtStart?: boolean },
  ) => Promise<number | null>;
};

/**
 * ONE foreground drive for every way a program can take the terminal pane
 * over: it streams output to the pane, forwards its keystrokes to stdin,
 * resumes input-starved stops, and stands down on halt, error, ctrl+c, a user
 * pause, or the loss of its pane.
 *
 * Three entry paths converge on it: `./name` through the terminal's own
 * dispatch (which calls driveForeground directly), a raw-mode program's
 * self-attach when `wantsTerminal` rises, and a terminal-mode program's run
 * press (requestTerminalRun, honoured by the attach effect once the lazily
 * mounted pane registers its io).
 *
 * The console watermark lives here too, pinned at the EARLIEST signal that
 * the terminal owns the run: the wantsTerminal rising edge or the drive's
 * attach, whichever comes first. The console is plain text and would render a
 * full-screen program's escape sequences as literal garbage, so it shows
 * output up to the watermark and one note in place of the session's bytes.
 */
export function useTerminalDrive(opts: {
  machine: RefObject<TerminalDriveMachine>;
  /** Render-time hub facts the two rising edges key on. */
  wantsTerminal: boolean;
  blocked: boolean;
  stdout: string;
  /** The launch mode as a ref: the blocked jump must not re-subscribe. */
  launchModeRef: RefObject<LaunchMode>;
  /** The terminal pane is the visible one (a hidden pane has no keyboard). */
  terminalTabActive: boolean;
  /** Bring a pane forward, on desktop tabs and the phone switcher alike. */
  requestPane: (pane: "term" | "console") => void;
}): TerminalDrive {
  const {
    machine,
    wantsTerminal,
    blocked,
    stdout,
    launchModeRef,
    terminalTabActive,
    requestPane,
  } = opts;

  // Nonce asking the attach effect to start a terminal-pane run once the
  // pane's io registration lands (the pane mounts lazily on tab switch).
  const [termRunRequest, setTermRunRequest] = useState<number | null>(null);
  // Live only while the host surface is mounted: a foreground drive polls
  // on a timer and must not outlive the surface it drives.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Mirrors termIO for the poll loop, which must notice a pane that went
  // away without waiting for a re-render.
  const termIORef = useRef<TerminalProgramIO | null>(null);
  // The pane's io surface. State, not a ref: the pane mounts lazily on first
  // tab activation, which happens AFTER a raw-mode program's rising edge
  // switches the tab, so the self-attach effect must re-fire when the
  // registration lands.
  const [termIO, setTermIO] = useState<TerminalProgramIO | null>(null);
  const foregroundActiveRef = useRef(false);
  // Mirrored as state so the console can render "this program reads from
  // the terminal" and disable its own stdin box while a session owns it.
  const [foregroundLive, setForegroundLive] = useState(false);
  const [terminalOwnedFrom, setTerminalOwnedFrom] = useState<number | null>(null);

  const registerTermIO = useCallback((io: TerminalProgramIO | null) => {
    // Keep the ref in lockstep so a live drive sees a pane teardown
    // immediately, not one render later.
    termIORef.current = io;
    setTermIO(io);
  }, []);

  const dropTerminalWatermark = useCallback(() => setTerminalOwnedFrom(null), []);

  // Reset and clear both empty the console, so the watermark they leave behind
  // describes bytes that no longer exist: it goes with them, and the next
  // console run renders with no watermark.
  const resetMachine = useCallback(() => {
    setTerminalOwnedFrom(null);
    machine.current.reset();
  }, [machine]);
  const clearConsoleAll = useCallback(() => {
    setTerminalOwnedFrom(null);
    machine.current.clearConsole();
  }, [machine]);

  const requestTerminalRun = useCallback(() => setTermRunRequest(Date.now()), []);

  // Auto-switch to the console on the false->true edge of `blocked` so the
  // student sees the scanf prompt. queueMicrotask defers the flip out of the
  // synchronous render phase. Terminal programs (raw mode) keep their
  // input in the terminal pane, so the console jump stands down for them.
  const lastBlockedRef = useRef(false);
  useEffect(() => {
    if (blocked && !lastBlockedRef.current) {
      lastBlockedRef.current = true;
      if (wantsTerminal) return;
      // A foreground terminal session owns the program's input even without raw
      // mode: a menu program run as `./program` reads its scanf lines from the
      // term pane, so the console jump stands down. A terminal-mode program
      // keeps that ownership for its whole life, including the gap before its
      // drive attaches: the console must never steal a read it cannot answer.
      if (foregroundActiveRef.current || launchModeRef.current === "terminal") return;
      queueMicrotask(() => {
        // Phones route panes through the pane switcher, not the tab state.
        requestPane("console");
      });
    } else if (!blocked) {
      lastBlockedRef.current = false;
    }
  }, [blocked, wantsTerminal, launchModeRef, requestPane]);

  // Hiding the pane blurs its textarea, so coming back to a live session needs
  // the keyboard handed over again, or the student types into nothing while the
  // console says "type in the terminal".
  useEffect(() => {
    if (!terminalTabActive || !foregroundLive) return;
    termIORef.current?.focus?.();
  }, [terminalTabActive, foregroundLive]);

  // A program that switches the terminal to raw mode is a terminal
  // program: hand it the terminal pane on the false->true edge, the same
  // way blocked hands scanf programs the console.
  const lastWantsTermRef = useRef(false);
  useEffect(() => {
    if (wantsTerminal && !lastWantsTermRef.current) {
      lastWantsTermRef.current = true;
      // For a raw-mode program this edge IS the session start: the tab
      // switch, the lazy pane mount, and the io registration all take
      // renders, and the program paints full frames through every one of
      // them. Pinning the console's watermark here rather than at the
      // drive's attach is what keeps those frames out of a plain-text
      // scrollback. Earliest pin wins, so the attach leaves it alone.
      setTerminalOwnedFrom((prev) => prev ?? stdout.length);
      queueMicrotask(() => {
        requestPane("term");
      });
    } else if (!wantsTerminal) {
      lastWantsTermRef.current = false;
    }
  }, [wantsTerminal, stdout, requestPane]);

  // The one foreground drive both entry paths share: stream output to
  // the pane, forward its keystrokes to stdin, resume input-starved
  // stops, and stand down on halt, error, cancel, or a user pause.
  const driveForeground = useCallback(
    async (
      io: TerminalProgramIO,
      driveOpts?: { clearAtStart?: boolean },
    ): Promise<number | null> => {
      if (foregroundActiveRef.current) return null;
      foregroundActiveRef.current = true;
      setForegroundLive(true);
      // Everything from here goes to the pane through the output tap below.
      // Pin where the console's scrollback stops so it can show what
      // printed BEFORE the takeover and one note in place of the rest.
      // A raw-mode program pinned this at its rising edge, several frames
      // ago; the earliest pin of a session wins, so this only fires for a
      // session that starts here (terminal mode's run, `./name`).
      setTerminalOwnedFrom((prev) => prev ?? machine.current.stdout.length);
      let cancelled = false;
      // Set once the pane we are driving has registered itself; after that,
      // losing the registration means the pane went away.
      let sawPane = false;
      // Wipe the pane once, the moment the program claims the terminal
      // (already true on self-attach; flips mid-run for ./name), so the
      // takeover starts on a clean screen with no earlier scrollback.
      let cleared = false;
      const clearOnce = () => {
        if (!cleared) {
          cleared = true;
          io.clear?.();
        }
      };
      if (driveOpts?.clearAtStart || machine.current.wantsTerminal) clearOnce();
      // Live sessions skip the step-back ring: the per-step clone costs
      // more than the step, and stepping back mid-session has no meaning.
      machine.current.setSnapshotsPaused(true);
      machine.current.setOutputTap((t) => io.write(t));
      // Cooked-mode input works like a canonical tty: the line buffers
      // locally with echo (so typed digits are visible) and backspace
      // editing, and reaches the program as one line ending in \n on
      // enter. Raw-mode programs (termios) get every byte untouched and
      // draw their own screens.
      let lineBuf = "";
      io.setForeground({
        pushInput: (d) => {
          const e = machine.current;
          // Keystrokes arrive one at a time, but a clipboard paste arrives
          // whole and the pane forwards it verbatim. Bound it here, where
          // both tty modes converge, so a pasted megabyte cannot land in
          // the machine's stdin queue in one gesture.
          const oversize = validateStdin(d);
          if (oversize) {
            io.write(`\r\n[${oversize}]\r\n`);
            return;
          }
          if (e.wantsTerminal) {
            e.pushStdin(d);
            return;
          }
          for (let i = 0; i < d.length; i++) {
            const ch = d[i];
            if (ch === "\r" || ch === "\n") {
              io.write("\r\n");
              e.pushStdin(`${lineBuf}\n`);
              lineBuf = "";
            } else if (ch === "\x7f" || ch === "\b") {
              if (lineBuf.length > 0) {
                lineBuf = lineBuf.slice(0, -1);
                io.write("\b \b");
              }
            } else if (ch === "\x1b") {
              // Swallow the rest of an escape sequence (arrow keys):
              // canonical reads have no use for it.
              return;
            } else if (ch >= " ") {
              lineBuf += ch;
              io.write(ch);
            }
          }
        },
        cancel: () => {
          cancelled = true;
          machine.current.pause();
        },
      });
      try {
        {
          const e = machine.current;
          if (!e.isRunning && !e.isHalted) e.run();
        }
        let resumeArmed = false;
        // The hub's isRunning/blocked arrive through React state, so the
        // first polls after run() can still read the pre-run snapshot.
        // Ending the session there printed "[program stopped]" over a
        // program that was only just starting, and handed its blocked
        // read to the console. Wait for real evidence it began.
        let started = false;
        const openedAt = Date.now();
        for (;;) {
          // 32ms: two frames, slow enough not to starve the machine and fast
          // enough that a keystroke echoes.
          await new Promise<void>((r) => setTimeout(r, 32));
          // Stand down if the host surface unmounted (a route change) or
          // the pane we are driving went away (a mobile pane switch
          // unmounts it). Without this the loop spins forever on a
          // blocked program, holding the console's stdin disabled and
          // the snapshot ring paused with no way back.
          if (!mountedRef.current) break;
          // A pane that unmounts deregisters by writing null, so "not this io"
          // has to include null. The earlier `!== null` clause let through the
          // one case this guard exists for. It stays tolerant only until the
          // pane first registers, since a drive can start a frame before that
          // lands.
          if (termIORef.current === io) sawPane = true;
          else if (sawPane || termIORef.current !== null) break;
          const e = machine.current;
          if (e.wantsTerminal) clearOnce();
          if (cancelled || e.isHalted || e.error) break;
          // An assemble or a reset mid-session drops the loaded flag: the
          // program this drive was running no longer exists, and the resume
          // latch below would otherwise start whatever took its place: pressing
          // Assemble while a session waited for input could set the freshly
          // assembled program running on its own.
          if (started && !e.programLoaded) break;
          if (e.isRunning || e.blocked) started = true;
          if (e.isRunning) continue;
          if (e.blocked) {
            resumeArmed = true;
            continue;
          }
          if (resumeArmed) {
            resumeArmed = false;
            machine.current.run();
            continue;
          }
          // Nothing observed yet: give the machine a moment to commit
          // its first state before deciding the session is over.
          if (!started && Date.now() - openedAt < 4000) continue;
          break;
        }
      } finally {
        machine.current.setSnapshotsPaused(false);
        machine.current.setOutputTap(null);
        io.setForeground(null);
        foregroundActiveRef.current = false;
        setForegroundLive(false);
      }
      const e = machine.current;
      return e.isHalted ? e.exitCode : null;
    },
    [machine],
  );

  // Attach a requested terminal-pane run: clear the pane (a previous
  // program's screen must not linger) and drive the workspace live,
  // with the pane printing the exit line when the session ends.
  useEffect(() => {
    if (termRunRequest == null || !termIO) return;
    // Check busy BEFORE consuming the nonce: dropping the request while
    // a session owns the pane silently swallowed the student's Run.
    if (foregroundActiveRef.current) return;
    setTermRunRequest(null);
    const io = termIO;
    void driveForeground(io, { clearAtStart: true }).then((exitCode) => {
      io.sessionEnded?.(exitCode);
    });
    // foregroundLive is a dependency so that a request held back above
    // gets another chance the moment the running session stands down.
    // Without it the request was preserved and then never honoured.
  }, [termRunRequest, termIO, driveForeground, foregroundLive]);

  // Self-attach: a raw-mode program started from the run button (not `./name`)
  // still needs live terminal I/O. When the flag rises and no session owns the
  // pane, the pane takes the program over and prints the exit line itself when
  // the session ends.
  useEffect(() => {
    if (!wantsTerminal) return;
    if (!termIO || foregroundActiveRef.current) return;
    const io = termIO;
    void driveForeground(io).then((exitCode) => {
      io.sessionEnded?.(exitCode);
    });
  }, [wantsTerminal, termIO, driveForeground]);

  return {
    terminalOwnedFrom,
    foregroundLive,
    dropTerminalWatermark,
    resetMachine,
    clearConsoleAll,
    requestTerminalRun,
    registerTermIO,
    driveForeground,
  };
}
