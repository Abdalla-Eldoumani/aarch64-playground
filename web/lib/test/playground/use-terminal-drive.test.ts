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

  it("goes with the bytes it describes: drop, reset, and clear", async () => {
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

  it("swallows an escape sequence, which a canonical read has no use for", async () => {
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

  it("bounds a pasted megabyte where both tty modes converge", async () => {
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
    await new Promise((r) => setTimeout(r, 80));
    expect(machine.run).toHaveBeenCalledTimes(1);
    machine.blocked = false;
    await waitFor(() => expect(machine.run).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await end();
  });
});

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
    expect(io.setForeground).toHaveBeenLastCalledWith(null);
    expect(h.drive().foregroundLive).toBe(false);
  });

  it("reports no exit code for a session that ended without halting", async () => {
    const machine = makeMachine({ exitCode: 7 });
    const { session } = await startSession(machine);
    let exit: number | null = 7;
    await act(async () => {
      machine.error = "memory fault: read at 0x0000000000000000";
      exit = await session;
    });
    expect(exit).toBeNull();
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
  });

  it("lets go when the pane it was driving goes away", async () => {
    // A mobile pane switch unmounts the pane, which deregisters with null.
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
  });
});
