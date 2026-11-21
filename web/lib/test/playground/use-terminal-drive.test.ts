// The terminal takeover state machine: who owns a run, when the console
// stands down, how keystrokes reach stdin in each tty mode, and what makes a
// foreground session let go. The hub arrives as a scripted machine ref, so a
// test can flip isHalted or drop programLoaded mid-session the way the real
// hub does between snapshots.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { TerminalProgramIO } from "@/lib/terminal/dispatch";
import type { LaunchMode } from "@/lib/playground/playground-handoff";
import { MAX_STDIN_BYTES } from "@/lib/playground/upload-guard";
import { appendBounded } from "@/lib/emulator/use-emulator";
import {
  useTerminalDrive,
  type TerminalDriveMachine,
} from "@/lib/playground/use-terminal-drive";

function makeMachine(overrides: Partial<TerminalDriveMachine> = {}): TerminalDriveMachine {
  const machine: TerminalDriveMachine = {
    stdout: "",
    isRunning: false,
    isHalted: false,
    blocked: false,
    programLoaded: true,
    wantsTerminal: false,
    error: null,
    exitCode: null,
    run: vi.fn(() => {
      machine.isRunning = true;
    }),
    pause: vi.fn(() => {
      machine.isRunning = false;
    }),
    reset: vi.fn(),
    clearConsole: vi.fn(),
    pushStdin: vi.fn(),
    setOutputTap: vi.fn(),
    setSnapshotsPaused: vi.fn(),
    setRealTime: vi.fn(),
    setWindowSize: vi.fn(),
    ...overrides,
  };
  return machine;
}

function makeIO() {
  return {
    write: vi.fn(),
    setForeground: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(),
    sessionEnded: vi.fn(),
    altScreen: vi.fn(() => false),
  };
}

type IO = ReturnType<typeof makeIO>;

/** The foreground surface the drive registered with the pane. */
function foregroundOf(io: IO) {
  const fg = vi.mocked(io.setForeground).mock.calls.at(-1)?.[0];
  expect(fg, "the drive never registered a foreground program").toBeTruthy();
  return fg!;
}

type Props = {
  wantsTerminal: boolean;
  blocked: boolean;
  stdout: string;
  terminalTabActive: boolean;
};

function setup(
  initial: Partial<Props> = {},
  machine: TerminalDriveMachine = makeMachine(),
  launchMode: LaunchMode = "console",
) {
  const machineRef = { current: machine };
  const launchModeRef = { current: launchMode };
  const requestPane = vi.fn();
  const rendered = renderHook(
    (props: Props) =>
      useTerminalDrive({ machine: machineRef, ...props, launchModeRef, requestPane }),
    {
      initialProps: {
        wantsTerminal: false,
        blocked: false,
        stdout: "",
        terminalTabActive: false,
        ...initial,
      },
    },
  );
  const props: Props = {
    wantsTerminal: false,
    blocked: false,
    stdout: "",
    terminalTabActive: false,
    ...initial,
  };
  /** Re-render with a changed hub fact, flushing the microtask the pane
   *  requests are queued on. */
  const update = async (next: Partial<Props>) => {
    Object.assign(props, next);
    await act(async () => {
      rendered.rerender({ ...props });
    });
  };
  return {
    machine,
    machineRef,
    launchModeRef,
    requestPane,
    rendered,
    update,
    drive: () => rendered.result.current,
  };
}

/** Run one session to its end, halting the machine so the poll loop stops. */
async function halt(machine: TerminalDriveMachine, session: Promise<number | null>) {
  machine.isRunning = false;
  machine.isHalted = true;
  return act(async () => await session);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the blocked -> console jump", () => {
  it("brings the console forward on the rising edge, once", async () => {
    const h = setup();
    await h.update({ blocked: true });
    expect(h.requestPane).toHaveBeenCalledWith("console");
    expect(h.requestPane).toHaveBeenCalledTimes(1);
    // Still blocked on the next render: the edge already fired.
    await h.update({ stdout: "prompt: " });
    expect(h.requestPane).toHaveBeenCalledTimes(1);
    // Answered, then blocked again: a new edge, a new jump.
    await h.update({ blocked: false });
    await h.update({ blocked: true });
    expect(h.requestPane).toHaveBeenCalledTimes(2);
  });

  it("stands down for a raw-mode program, which reads in the terminal", async () => {
    const h = setup({ wantsTerminal: true });
    await h.update({ blocked: true });
    expect(h.requestPane).not.toHaveBeenCalledWith("console");
  });

  it("stands down for a terminal-mode launch, including before its drive attaches", async () => {
    // The console must never steal a read it cannot answer.
    const h = setup({}, makeMachine(), "terminal");
    await h.update({ blocked: true });
    expect(h.requestPane).not.toHaveBeenCalledWith("console");
  });

  it("stands down while a foreground session owns the program's input", async () => {
    // A cooked-mode menu run as `./program` reads its scanf lines from the
    // pane, so the console jump has no business firing.
    const h = setup();
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    h.machine.blocked = true;
    await h.update({ blocked: true });
    expect(h.requestPane).not.toHaveBeenCalledWith("console");
    h.machine.blocked = false;
    await halt(h.machine, session);
  });
});

describe("the console watermark", () => {
  it("pins at the raw-mode rising edge, several frames before any drive", async () => {
    // The tab switch, the lazy pane mount, and the io registration all take
    // renders, and the program paints full frames through every one of them.
    const h = setup({ stdout: "before takeover\n" });
    await h.update({ wantsTerminal: true });
    expect(h.drive().terminalOwnedFrom).toBe("before takeover\n".length);
    expect(h.requestPane).toHaveBeenCalledWith("term");
  });

  it("keeps the earliest pin when a drive attaches later", async () => {
    const h = setup({ stdout: "early\n" });
    await h.update({ wantsTerminal: true });
    const pinned = h.drive().terminalOwnedFrom;
    h.machine.stdout = "early\nand a whole screen of frames\n";
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    expect(h.drive().terminalOwnedFrom).toBe(pinned);
    await halt(h.machine, session);
  });

  it("pins at the drive's attach for a session that starts there", async () => {
    const h = setup();
    h.machine.stdout = "console output\n";
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    expect(h.drive().terminalOwnedFrom).toBe("console output\n".length);
    await halt(h.machine, session);
  });

  it("is cleared with the output it marks: drop, reset, and clear", async () => {
    const h = setup({ stdout: "x" });
    await h.update({ wantsTerminal: true });
    expect(h.drive().terminalOwnedFrom).toBe(1);

    act(() => h.drive().dropTerminalWatermark());
    expect(h.drive().terminalOwnedFrom).toBeNull();

    await h.update({ wantsTerminal: false });
    await h.update({ wantsTerminal: true });
    expect(h.drive().terminalOwnedFrom).toBe(1);
    act(() => h.drive().resetMachine());
    expect(h.drive().terminalOwnedFrom).toBeNull();
    expect(h.machine.reset).toHaveBeenCalledTimes(1);

    await h.update({ wantsTerminal: false });
    await h.update({ wantsTerminal: true });
    act(() => h.drive().clearConsoleAll());
    expect(h.drive().terminalOwnedFrom).toBeNull();
    expect(h.machine.clearConsole).toHaveBeenCalledTimes(1);
  });
});

describe("attaching a session", () => {
  it("holds a run request until the lazily mounted pane registers its io", async () => {
    const h = setup();
    act(() => h.drive().requestTerminalRun());
    const io = makeIO();
    expect(io.setForeground).not.toHaveBeenCalled();

    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    // A requested run wipes the pane first: a previous program's screen must
    // not linger under this one.
    expect(io.clear).toHaveBeenCalledTimes(1);
    expect(h.machine.run).toHaveBeenCalledTimes(1);
    expect(h.machine.setSnapshotsPaused).toHaveBeenCalledWith(true);
    expect(h.machine.setOutputTap).toHaveBeenCalled();
    expect(h.drive().foregroundLive).toBe(true);

    h.machine.exitCode = 0;
    await act(async () => {
      h.machine.isRunning = false;
      h.machine.isHalted = true;
      await waitFor(() => expect(io.sessionEnded).toHaveBeenCalledWith(0));
    });
    expect(h.drive().foregroundLive).toBe(false);
  });

  it("streams program output into the pane through the tap", async () => {
    const h = setup();
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    const tap = vi.mocked(h.machine.setOutputTap).mock.calls[0][0];
    tap!("sum = 12\n");
    expect(io.write).toHaveBeenCalledWith("sum = 12\n");
    await halt(h.machine, session);
  });

  it("self-attaches a raw-mode program that was started from the run button", async () => {
    const machine = makeMachine({ wantsTerminal: true });
    const h = setup({ wantsTerminal: true }, machine);
    const io = makeIO();
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    // A program already in raw mode gets its pane wiped without the
    // clearAtStart flag a requested run passes.
    expect(io.clear).toHaveBeenCalledTimes(1);
    machine.exitCode = 0;
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      await waitFor(() => expect(io.sessionEnded).toHaveBeenCalledWith(0));
    });
  });

  it("refuses a second drive while one owns the pane, and honours a held request after", async () => {
    const h = setup();
    const io = makeIO();
    let first!: Promise<number | null>;
    act(() => {
      first = h.drive().driveForeground(io as TerminalProgramIO);
    });
    let second: number | null = 1;
    await act(async () => {
      second = await h.drive().driveForeground(io as TerminalProgramIO);
    });
    expect(second).toBeNull();
    expect(io.setForeground).toHaveBeenCalledTimes(1);

    // The pane is registered and a run is pressed while the session lives:
    // dropping the request here silently swallowed the student's Run.
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
      h.drive().requestTerminalRun();
    });
    await halt(h.machine, first);
    await waitFor(() => expect(io.clear).toHaveBeenCalled());
    expect(io.setForeground.mock.calls.filter((c) => c[0] !== null)).toHaveLength(2);
  });

  it("hands the keyboard back when the pane comes forward mid-session", async () => {
    const h = setup();
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    // Hiding the pane blurs its textarea, so returning to the tab needs the
    // focus handed over again.
    await h.update({ terminalTabActive: true });
    expect(io.focus).toHaveBeenCalled();
    await halt(h.machine, session);
  });
});

describe("forwarding keystrokes", () => {
  async function withSession(machine: TerminalDriveMachine) {
    const h = setup({}, machine);
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    return { h, io, end: () => halt(machine, session) };
  }

  it("buffers a cooked-mode line locally, echoes it, and sends it on enter", async () => {
    const machine = makeMachine();
    const { io, end } = await withSession(machine);
    const fg = foregroundOf(io);
    fg.pushInput("4");
    fg.pushInput("2");
    expect(io.write).toHaveBeenCalledWith("4");
    expect(io.write).toHaveBeenCalledWith("2");
    expect(machine.pushStdin).not.toHaveBeenCalled();
    fg.pushInput("\r");
    expect(io.write).toHaveBeenCalledWith("\r\n");
    expect(machine.pushStdin).toHaveBeenCalledWith("42\n");
    // The buffer starts empty for the next line.
    fg.pushInput("7\n");
    expect(machine.pushStdin).toHaveBeenLastCalledWith("7\n");
    await end();
  });

  it("edits the cooked line with backspace and stops at an empty buffer", async () => {
    const machine = makeMachine();
    const { io, end } = await withSession(machine);
    const fg = foregroundOf(io);
    fg.pushInput("4");
    fg.pushInput("9");
    fg.pushInput("\x7f");
    expect(io.write).toHaveBeenLastCalledWith("\b \b");
    io.write.mockClear();
    fg.pushInput("\b");
    fg.pushInput("\b");
    // Only one character was left to erase; the rest write nothing.
    expect(io.write).toHaveBeenCalledTimes(1);
    fg.pushInput("\r");
    expect(machine.pushStdin).toHaveBeenCalledWith("\n");
    await end();
  });

  it("swallows an escape sequence, which a cooked-mode read has no use for", async () => {
    const machine = makeMachine();
    const { io, end } = await withSession(machine);
    const fg = foregroundOf(io);
    fg.pushInput("\x1b[A");
    expect(io.write).not.toHaveBeenCalled();
    fg.pushInput("\r");
    expect(machine.pushStdin).toHaveBeenCalledWith("\n");
    await end();
  });

  it("hands a raw-mode program every byte untouched, with no echo", async () => {
    const machine = makeMachine({ wantsTerminal: true });
    const { io, end } = await withSession(machine);
    const fg = foregroundOf(io);
    fg.pushInput("w");
    fg.pushInput("\x1b[B");
    expect(machine.pushStdin).toHaveBeenNthCalledWith(1, "w");
    expect(machine.pushStdin).toHaveBeenNthCalledWith(2, "\x1b[B");
    expect(io.write).not.toHaveBeenCalled();
    await end();
  });

  it("refuses a pasted megabyte at the stdin cap both tty modes share", async () => {
    const machine = makeMachine();
    const { io, end } = await withSession(machine);
    foregroundOf(io).pushInput("x".repeat(MAX_STDIN_BYTES + 1));
    expect(machine.pushStdin).not.toHaveBeenCalled();
    expect(io.write).toHaveBeenCalledWith("\r\n[stdin too large: the limit is 100 KiB]\r\n");
    await end();
  });

  it("resumes an input-starved program once its read is answered", async () => {
    const machine = makeMachine();
    const { end } = await withSession(machine);
    // The machine parks on a read: running stops, blocked rises.
    machine.isRunning = false;
    machine.blocked = true;
    // longer than one poll interval, so the drive has seen the parked read
    await new Promise((r) => setTimeout(r, 80));
    expect(machine.run).toHaveBeenCalledTimes(1);
    machine.blocked = false;
    await waitFor(() => expect(machine.run).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await end();
  });
});

/** Real time goes on after the ring pauses and off before it resumes, once
 *  each, so no step the ring records ran under real time. */
function expectRealTimeInsideThePause(machine: TerminalDriveMachine) {
  const pause = vi.mocked(machine.setSnapshotsPaused).mock;
  const real = vi.mocked(machine.setRealTime).mock;
  expect(pause.calls).toEqual([[true], [false]]);
  expect(real.calls).toEqual([[true], [false]]);
  expect(pause.invocationCallOrder[0]).toBeLessThan(real.invocationCallOrder[0]);
  expect(real.invocationCallOrder[1]).toBeLessThan(pause.invocationCallOrder[1]);
}

describe("standing down", () => {
  async function startSession(machine: TerminalDriveMachine) {
    const h = setup({}, machine);
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    return { h, io, session };
  }

  it("releases the tap, the pane, and the snapshot ring on halt", async () => {
    const machine = makeMachine({ exitCode: 7 });
    const { h, io, session } = await startSession(machine);
    let exit: number | null = null;
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      exit = await session;
    });
    expect(exit).toBe(7);
    expect(machine.setOutputTap).toHaveBeenLastCalledWith(null);
    expect(machine.setSnapshotsPaused).toHaveBeenLastCalledWith(false);
    expectRealTimeInsideThePause(machine);
    expect(io.setForeground).toHaveBeenLastCalledWith(null);
    expect(h.drive().foregroundLive).toBe(false);
  });

  it("reports no exit code for a session that ended without halting", async () => {
    const machine = makeMachine({ exitCode: 7 });
    const { session } = await startSession(machine);
    let exit: number | null = 7;
    await act(async () => {
      machine.error =
        "memory fault: the program tried to read 0x0000000000000000, which no section covers. The base register (the first one inside the brackets, or a pointer passed to a call) does not hold an address, usually because `ldr xN, label` lost its `=` (it loads the value stored at the label) or a `mov` was written where `ldr xN, =label` was meant";
      exit = await session;
    });
    expect(exit).toBeNull();
    expectRealTimeInsideThePause(machine);
  });

  it("stops on ctrl+c by pausing the machine", async () => {
    const machine = makeMachine();
    const { io, session } = await startSession(machine);
    let exit: number | null = 0;
    await act(async () => {
      foregroundOf(io).cancel();
      exit = await session;
    });
    expect(machine.pause).toHaveBeenCalledTimes(1);
    expect(exit).toBeNull();
    expectRealTimeInsideThePause(machine);
  });

  it("lets go when the pane it was driving goes away", async () => {
    // A switch between the phone, tablet and laptop layouts unmounts the
    // pane, which deregisters with null.
    // Without this the loop spun forever on a blocked program, holding the
    // console's stdin disabled and the snapshot ring paused.
    const machine = makeMachine();
    const { h, io, session } = await startSession(machine);
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
      // Let one poll see the pane first: the guard stays tolerant of a null
      // registration only until the pane has registered once, because a drive
      // can start a frame before that lands.
      await new Promise((r) => setTimeout(r, 50));
    });
    machine.isRunning = false;
    machine.blocked = true;
    await act(async () => {
      h.drive().registerTermIO(null);
      await session;
    });
    expect(machine.setSnapshotsPaused).toHaveBeenLastCalledWith(false);
    expectRealTimeInsideThePause(machine);
  });

  it("lets go when an assemble replaces the program under it", async () => {
    // The resume latch would otherwise start whatever took its place:
    // pressing Assemble while a session waited for input set the freshly
    // assembled program running on its own.
    const machine = makeMachine();
    const { session } = await startSession(machine);
    await new Promise((r) => setTimeout(r, 40));
    await act(async () => {
      machine.isRunning = false;
      machine.programLoaded = false;
      await session;
    });
    expect(machine.run).toHaveBeenCalledTimes(1);
    expectRealTimeInsideThePause(machine);
  });

  it("lets go when the host surface unmounts", async () => {
    const machine = makeMachine();
    const { h, session } = await startSession(machine);
    let exit: number | null = 0;
    await act(async () => {
      h.rendered.unmount();
      exit = await session;
    });
    expect(exit).toBeNull();
    expect(machine.setOutputTap).toHaveBeenLastCalledWith(null);
    expectRealTimeInsideThePause(machine);
  });
});

describe("the pane's size", () => {
  async function startSession(machine: TerminalDriveMachine) {
    const h = setup({}, machine);
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    return { io, session };
  }

  /** Every size the machine got went in after the ring paused, and the last
   *  one, which takes the size away, before the ring resumed: no step the
   *  ring records ever asked for the pane's size. */
  function expectSizeInsideThePause(machine: TerminalDriveMachine) {
    const pause = vi.mocked(machine.setSnapshotsPaused).mock;
    const size = vi.mocked(machine.setWindowSize).mock;
    expect(size.calls.at(-1)).toEqual([0, 0]);
    expect(pause.invocationCallOrder[0]).toBeLessThan(size.invocationCallOrder[0]);
    expect(size.invocationCallOrder.at(-1)).toBeLessThan(pause.invocationCallOrder[1]);
  }

  it("hands the machine the size the pane gives the program, and every resize after it", async () => {
    const machine = makeMachine({ exitCode: 0 });
    const { io, session } = await startSession(machine);
    // The pane hands its columns and rows over as the program takes it.
    foregroundOf(io).resize(48, 43);
    foregroundOf(io).resize(80, 24);
    await halt(machine, session);
    expect(vi.mocked(machine.setWindowSize).mock.calls).toEqual([[48, 43], [80, 24], [0, 0]]);
    expectSizeInsideThePause(machine);
  });

  it("takes the size away when ctrl+c stops a program that stays loaded", async () => {
    // The paused program can still be stepped or run on in the console,
    // where no pane answers for its size.
    const machine = makeMachine();
    const { io, session } = await startSession(machine);
    foregroundOf(io).resize(48, 43);
    await act(async () => {
      foregroundOf(io).cancel();
      await session;
    });
    expectSizeInsideThePause(machine);
  });

  it("lets a new session's size stand after an assemble ends the old one", async () => {
    // An assemble mid-session ends the old drive on its next poll, and a run
    // press right after asks for a new one. Had the new session started
    // first, the old one's (0, 0) would land on the new program, and nothing
    // would send the size again until the pane next resized. The machine is
    // modelled here: what it holds when each run starts is what the
    // program's first ask answers.
    let size: [number, number] | null = null;
    let paused = false;
    const atRun: Array<{ size: [number, number] | null; paused: boolean }> = [];
    const machine = makeMachine({
      setWindowSize: vi.fn((cols: number, rows: number) => {
        size = cols > 0 && rows > 0 ? [cols, rows] : null;
      }),
      setSnapshotsPaused: vi.fn((p: boolean) => {
        paused = p;
      }),
    });
    machine.run = vi.fn(() => {
      machine.isRunning = true;
      atRun.push({ size, paused });
    });
    const h = setup({}, machine, "terminal");
    const io = makeIO();
    // The pane hands every program that takes it over its size.
    vi.mocked(io.setForeground).mockImplementation((fg) => fg?.resize(48, 43));
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
      h.drive().requestTerminalRun();
    });
    await waitFor(() => expect(machine.run).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 40));
    // The assemble drops the loaded flag, and the run press comes at once.
    machine.isRunning = false;
    machine.programLoaded = false;
    await act(async () => {
      h.drive().requestTerminalRun();
    });
    await waitFor(() => expect(machine.setSnapshotsPaused).toHaveBeenCalledWith(false), {
      timeout: 2000,
    });
    // The new program is loaded by the time the old drive has let go.
    machine.programLoaded = true;
    await waitFor(() => expect(machine.run).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(atRun).toEqual([
      { size: [48, 43], paused: true },
      { size: [48, 43], paused: true },
    ]);
    expect(vi.mocked(machine.setWindowSize).mock.calls).toEqual([[48, 43], [0, 0], [48, 43]]);
    machine.isRunning = false;
    machine.isHalted = true;
    await waitFor(() => expect(h.drive().foregroundLive).toBe(false), { timeout: 2000 });
  });
});

describe("putting the pane back when a session ends", () => {
  // What a stopped program may have left set in the pane: its alternate
  // screen (left only while it is still up, since leaving it moves the
  // cursor), then a soft reset (cursor shown, wrapping on, plain text),
  // mouse reporting off, and the theme's palette (OSC 104).
  const MAIN_SCREEN = "\x1b[?1049l";
  const PUT_BACK = "\x1b[!p\x1b[?1000l\x1b[?1006l\x1b]104\x07";

  type Started = {
    h: ReturnType<typeof setup>;
    machine: TerminalDriveMachine;
    io: IO;
  };
  const ends: Array<[string, (s: Started) => void | Promise<void>]> = [
    [
      "the program exits",
      ({ machine }) => {
        machine.isRunning = false;
        machine.isHalted = true;
      },
    ],
    [
      "the program faults",
      ({ machine }) => {
        machine.isRunning = false;
        machine.error = "memory fault: the program tried to read 0x0000000000000000";
      },
    ],
    ["ctrl+c stops it", ({ io }) => foregroundOf(io).cancel()],
    [
      "the pause button stops it",
      ({ machine }) => {
        machine.isRunning = false;
      },
    ],
    [
      "an assemble or a reset replaces it",
      ({ machine }) => {
        machine.isRunning = false;
        machine.programLoaded = false;
      },
    ],
    [
      "the pane goes away",
      async ({ h, io }) => {
        h.drive().registerTermIO(io as TerminalProgramIO);
        await new Promise((r) => setTimeout(r, 50));
        h.drive().registerTermIO(null);
      },
    ],
    ["the host surface unmounts", ({ h }) => h.rendered.unmount()],
  ];

  async function runToEnd(end: (s: Started) => void | Promise<void>, altScreen: boolean) {
    const machine = makeMachine({ exitCode: 0 });
    const h = setup({}, machine);
    const io = makeIO();
    io.altScreen.mockReturnValue(altScreen);
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    // One poll sees the program running before it ends.
    await new Promise((r) => setTimeout(r, 40));
    await act(async () => {
      await end({ h, machine, io });
      await session;
    });
    return { machine, io };
  }

  it.each(ends)("writes it once when %s, after the program's last byte", async (_, end) => {
    const { machine, io } = await runToEnd(end, true);
    const writes = io.write.mock.calls.map(([text]) => text);
    expect(writes.filter((text) => text.includes("]104"))).toEqual([MAIN_SCREEN + PUT_BACK]);
    // The tap lets go first, so no byte of the program's lands after it.
    expect(machine.setOutputTap).toHaveBeenLastCalledWith(null);
    const at = io.write.mock.invocationCallOrder[writes.indexOf(MAIN_SCREEN + PUT_BACK)];
    expect(vi.mocked(machine.setOutputTap).mock.invocationCallOrder.at(-1)).toBeLessThan(at);
  });

  it("leaves the screen and the cursor where a program that put them back left them", async () => {
    // A program that left its alternate screen itself may have printed below
    // it since: a second exit from it would move the cursor back over that.
    const { io } = await runToEnd(ends[0][1], false);
    const writes = io.write.mock.calls.map(([text]) => text);
    expect(writes.filter((text) => text.includes("]104"))).toEqual([PUT_BACK]);
    expect(writes.some((text) => text.includes("?1049"))).toBe(false);
  });

  it("puts the pane back before it prints the exit line", async () => {
    const machine = makeMachine({ wantsTerminal: true, exitCode: 0 });
    const h = setup({ wantsTerminal: true }, machine);
    const io = makeIO();
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      await waitFor(() => expect(io.sessionEnded).toHaveBeenCalledWith(0));
    });
    const index = io.write.mock.calls.findIndex(([text]) => text === PUT_BACK);
    expect(io.write.mock.invocationCallOrder[index]).toBeLessThan(
      io.sessionEnded.mock.invocationCallOrder[0],
    );
  });
});

describe("what a raw-mode program wrote before the pane took it", () => {
  // A program run in the console sets its terminal up (alternate screen,
  // mouse reporting, palette) in the same chunk that turns raw mode on, so
  // those bytes reach the console before the pane can attach.
  async function selfAttach(stdout: string) {
    const machine = makeMachine({ wantsTerminal: true, stdout, exitCode: 0 });
    const h = setup({ wantsTerminal: true, stdout }, machine);
    const io = makeIO();
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    const end = () =>
      act(async () => {
        machine.isRunning = false;
        machine.isHalted = true;
        await waitFor(() => expect(io.sessionEnded).toHaveBeenCalled());
      });
    return { machine, io, end };
  }

  it("replays the run's console output into the pane after the wipe, before any new byte", async () => {
    const before = "\x1b[?1049h\x1b[?1000h\x1b[?1006hterminal is 80x24";
    const { machine, io, end } = await selfAttach(before);
    vi.mocked(machine.setOutputTap).mock.calls[0][0]!("frame");
    expect(io.write.mock.calls.slice(0, 2)).toEqual([[before], ["frame"]]);
    expect(io.clear.mock.invocationCallOrder[0]).toBeLessThan(io.write.mock.invocationCallOrder[0]);
    await end();
  });

  it("never replays the console into a requested run or a ./name session", async () => {
    // Only the self-attach starts where the console's run starts: a terminal
    // build keeps the editor's console as history, and ./name starts right
    // after one, where the hub can still say raw mode from a paused program.
    const stdout = "the editor's run printed this\n";
    const requested = makeMachine({ stdout, exitCode: 0 });
    const h = setup({}, requested, "terminal");
    const io = makeIO();
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
      h.drive().requestTerminalRun();
    });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    expect(io.write).not.toHaveBeenCalledWith(stdout);
    await act(async () => {
      requested.isRunning = false;
      requested.isHalted = true;
      await waitFor(() => expect(io.sessionEnded).toHaveBeenCalled());
    });

    const named = makeMachine({ stdout, wantsTerminal: true, exitCode: 0 });
    const n = setup({}, named);
    const io2 = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = n.drive().driveForeground(io2 as TerminalProgramIO);
    });
    expect(io2.write).not.toHaveBeenCalledWith(stdout);
    await halt(named, session);
  });

  it("replays nothing into a pane that remounts during a session it already took over", async () => {
    // A crossing into the phone layout remounts the pane mid-session: the
    // self-attach comes again, but the run's setup already went to the pane.
    const stdout = "\x1b[?1000hRAWFRAME";
    const machine = makeMachine({ wantsTerminal: true, stdout });
    const h = setup({ wantsTerminal: true, stdout }, machine);
    const first = makeIO();
    await act(async () => {
      h.drive().registerTermIO(first as TerminalProgramIO);
    });
    await waitFor(() => expect(first.write).toHaveBeenCalledWith(stdout));
    await new Promise((r) => setTimeout(r, 50));
    const second = makeIO();
    await act(async () => {
      h.drive().registerTermIO(null);
      await new Promise((r) => setTimeout(r, 80));
      h.drive().registerTermIO(second as TerminalProgramIO);
    });
    await waitFor(() => expect(second.setForeground).toHaveBeenCalled());
    expect(second.write).not.toHaveBeenCalledWith(stdout);
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      await waitFor(() => expect(second.sessionEnded).toHaveBeenCalled());
    });
  });

  it("replays nothing into a pane that remounts during a ./name session", async () => {
    // The console still holds an earlier editor run's text: a terminal build
    // keeps it as history. The program turns raw while ./name drives it, and a
    // remount then attaches a new pane to that same program.
    const stdout = "the editor's run printed this\n";
    const machine = makeMachine({ stdout, exitCode: 0 });
    const h = setup({ stdout }, machine);
    const first = makeIO();
    let session!: Promise<number | null>;
    await act(async () => {
      h.drive().registerTermIO(first as TerminalProgramIO);
      session = h.drive().driveForeground(first as TerminalProgramIO);
    });
    await new Promise((r) => setTimeout(r, 50));
    machine.wantsTerminal = true;
    await h.update({ wantsTerminal: true });
    const second = makeIO();
    await act(async () => {
      h.drive().registerTermIO(null);
      await session;
      h.drive().registerTermIO(second as TerminalProgramIO);
    });
    await waitFor(() => expect(second.setForeground).toHaveBeenCalled());
    expect(second.write).not.toHaveBeenCalledWith(stdout);
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      await waitFor(() => expect(second.sessionEnded).toHaveBeenCalled());
    });
  });

  it("replays only what the run wrote from the chunk that turned raw mode on", async () => {
    // Text the console held before that chunk (an earlier run's, or this
    // program's own before raw mode) stays in the console.
    const before = "kept from a terminal build\n";
    const raw = "\x1b[?1000hRAWFRAME";
    const machine = makeMachine({ stdout: before });
    const h = setup({ stdout: before }, machine);
    const io = makeIO();
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    machine.wantsTerminal = true;
    machine.stdout = before + raw;
    await h.update({ wantsTerminal: true, stdout: before + raw });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    expect(io.write.mock.calls[0]).toEqual([raw]);
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      await waitFor(() => expect(io.sessionEnded).toHaveBeenCalled());
    });
  });

  it("still replays that chunk when the console is full and drops as much as it adds", async () => {
    // A program that printed past the console's 256 KB before raw mode: the
    // chunk that turns raw mode on trims its own length off the head, so the
    // console's length does not move.
    const before = appendBounded("", Array.from({ length: 30_000 }, (_, i) => `line ${i}\n`).join(""));
    const raw = "\x1b[?1000hRAWFRAME";
    const after = appendBounded(before, raw);
    expect(after.length).toBe(before.length);
    const machine = makeMachine({ stdout: before });
    const h = setup({ stdout: before }, machine);
    const io = makeIO();
    await act(async () => {
      h.drive().registerTermIO(io as TerminalProgramIO);
    });
    machine.wantsTerminal = true;
    machine.stdout = after;
    await h.update({ wantsTerminal: true, stdout: after });
    await waitFor(() => expect(io.setForeground).toHaveBeenCalled());
    expect(io.write.mock.calls[0]).toEqual([raw]);
    await act(async () => {
      machine.isRunning = false;
      machine.isHalted = true;
      await waitFor(() => expect(io.sessionEnded).toHaveBeenCalled());
    });
  });

  it("leaves a ./name program's screen alone when it turns raw mid-run", async () => {
    // A wipe there came after the program's first chunk: it blanked a size
    // notice and dropped the mouse reporting the program had just turned on.
    const machine = makeMachine({ exitCode: 0 });
    const h = setup({}, machine);
    const io = makeIO();
    let session!: Promise<number | null>;
    act(() => {
      session = h.drive().driveForeground(io as TerminalProgramIO);
    });
    vi.mocked(machine.setOutputTap).mock.calls[0][0]!("\x1b[?1000hterminal is 81x5");
    machine.wantsTerminal = true;
    await new Promise((r) => setTimeout(r, 80));
    expect(io.clear).not.toHaveBeenCalled();
    expect(io.write.mock.calls.filter(([t]) => t === "\x1b[?1000hterminal is 81x5")).toHaveLength(1);
    await halt(machine, session);
  });
});
