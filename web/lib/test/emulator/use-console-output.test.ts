import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { EmulatorBackend } from "@/lib/emulator/backend";
import {
  CONSOLE_TRIM_MARKER,
  MAX_CONSOLE_CHARS,
  appendBoundedTracked,
  useConsoleOutput,
} from "@/lib/emulator/use-console-output";

// The console scrollback's absolute-coordinate model: the machine counts
// display BYTES from the start of the session, the scrollback holds a
// bounded tail of them, and syncSeen keeps the two aligned in both
// directions: forward when bytes went somewhere else (the terminal pane, a
// cleared console), backward when a step back or a restored save undid what
// was printed. Every expected byte count here is derived by hand.

afterEach(cleanup);

// The hook only reaches the backend through clearConsole; every test here
// stays on the scrollback side of that line.
const noBackend = { current: null as EmulatorBackend | null };

function mount() {
  return renderHook(() => useConsoleOutput(noBackend));
}

describe("appendBoundedTracked", () => {
  it("passes output through untouched under the cap", () => {
    expect(appendBoundedTracked("hello ", "world")).toEqual({
      text: "hello world",
      droppedBytes: 0,
    });
  });

  it("reports the machine bytes the bound dropped off the head", () => {
    const prev = "x".repeat(MAX_CONSOLE_CHARS);
    const { text, droppedBytes } = appendBoundedTracked(prev, "TAIL");
    expect(text.startsWith(CONSOLE_TRIM_MARKER)).toBe(true);
    expect(text.endsWith("TAIL")).toBe(true);
    expect(text.length).toBe(MAX_CONSOLE_CHARS + CONSOLE_TRIM_MARKER.length);
    // Four ASCII chars fell off the head, so four machine bytes did.
    expect(droppedBytes).toBe(4);
  });

  it("counts a dropped multibyte char by its bytes, not its chars", () => {
    // One char off the head, but the euro sign is three UTF-8 bytes.
    const prev = "€" + "x".repeat(MAX_CONSOLE_CHARS - 1);
    expect(appendBoundedTracked(prev, "!").droppedBytes).toBe(3);
  });

  it("never truncates into the marker a previous trim left behind", () => {
    // The marker is web text standing for zero machine bytes: counting its 30
    // chars against the cap would shave the marker in half and prefix a
    // second one.
    const body = "a".repeat(MAX_CONSOLE_CHARS - 10);
    const { text, droppedBytes } = appendBoundedTracked(
      CONSOLE_TRIM_MARKER + body,
      "b".repeat(5),
    );
    expect(text).toBe(CONSOLE_TRIM_MARKER + body + "b".repeat(5));
    expect(droppedBytes).toBe(0);
    expect(text.split(CONSOLE_TRIM_MARKER)).toHaveLength(2);
  });
});

describe("useConsoleOutput byte position", () => {
  it("leaves the transcript alone when the counter tracks the appends", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("Enter n: ");
      result.current.syncSeen("stdout", 9);
    });
    expect(result.current.stdout).toBe("Enter n: ");
    act(() => {
      result.current.appendStdout("21\ntwice 42\n");
      result.current.syncSeen("stdout", 21);
    });
    expect(result.current.stdout).toBe("Enter n: 21\ntwice 42\n");
  });

  it("unprints back to a counter that moved backward", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("Enter n: 21\ntwice 42\n");
      result.current.syncSeen("stdout", 21);
    });
    // Step back over the second printf: the machine reports the frame's
    // nine bytes, so the answer it printed comes off the transcript.
    act(() => result.current.syncSeen("stdout", 9));
    expect(result.current.stdout).toBe("Enter n: ");
    // And a re-run reprints from there without duplicating the prompt.
    act(() => {
      result.current.appendStdout("21\ntwice 42\n");
      result.current.syncSeen("stdout", 21);
    });
    expect(result.current.stdout).toBe("Enter n: 21\ntwice 42\n");
  });

  it("cuts in byte space, so a multibyte delta rewinds by bytes", () => {
    const { result } = mount();
    // "h" is one byte, "e" with an acute accent is two, "llo" is three:
    // six bytes for five chars.
    act(() => {
      result.current.appendStdout("héllo");
      result.current.syncSeen("stdout", 6);
    });
    expect(result.current.stdout).toBe("héllo");
    act(() => result.current.syncSeen("stdout", 3));
    expect(result.current.stdout).toBe("hé");
  });

  it("keeps the trim marker when the rewind runs past everything held", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("x".repeat(MAX_CONSOLE_CHARS));
      result.current.appendStdout("TAIL");
      // The bound dropped four bytes off the head, so the machine's total
      // is four bytes ahead of what the scrollback still represents.
      result.current.syncSeen("stdout", MAX_CONSOLE_CHARS + 4);
    });
    expect(result.current.stdout.startsWith(CONSOLE_TRIM_MARKER)).toBe(true);
    expect(result.current.stdout.endsWith("TAIL")).toBe(true);

    // A rewind below the trimmed head cannot reach into text that is gone:
    // it clamps at the marker, which the student still needs to see.
    act(() => result.current.syncSeen("stdout", 2));
    expect(result.current.stdout).toBe(CONSOLE_TRIM_MARKER);
    act(() => {
      result.current.appendStdout("after");
      result.current.syncSeen("stdout", 7);
    });
    expect(result.current.stdout).toBe(CONSOLE_TRIM_MARKER + "after");
  });

  it("re-anchors instead of unprinting after the scrollback is cleared", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("first run\n");
      result.current.syncSeen("stdout", 10);
    });
    // clear_console empties the web scrollback and leaves the machine's
    // counter where it was, so the next snapshot must read as a no-op.
    act(() => result.current.clearScrollback());
    act(() => result.current.syncSeen("stdout", 10));
    expect(result.current.stdout).toBe("");
    act(() => {
      result.current.appendStdout("second\n");
      result.current.syncSeen("stdout", 17);
    });
    expect(result.current.stdout).toBe("second\n");
  });

  it("re-anchors when a reset empties the scrollback and restarts the counter", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("previous program\n");
      result.current.syncSeen("stdout", 17);
    });
    // Assemble and reset wipe the scrollback here and the machine's own
    // buffers a moment later, so the next counter comes back at zero: the
    // offset has to follow it down, or every later append reads as output
    // the machine has not printed yet and unprints itself.
    act(() => result.current.clearScrollback());
    act(() => result.current.syncSeen("stdout", 0));
    act(() => {
      result.current.appendStdout("fresh\n");
      result.current.syncSeen("stdout", 6);
    });
    expect(result.current.stdout).toBe("fresh\n");
  });

  it("treats a restored counter beyond the transcript as a no-op", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("held\n");
      result.current.syncSeen("stdout", 5);
    });
    // A named save restored from further along legitimately reports more
    // bytes than this scrollback ever held; nothing is invented for them.
    act(() => result.current.syncSeen("stdout", 4096));
    expect(result.current.stdout).toBe("held\n");
    act(() => {
      result.current.appendStdout("more\n");
      result.current.syncSeen("stdout", 4101);
    });
    expect(result.current.stdout).toBe("held\nmore\n");
  });

  it("re-anchors over bytes the terminal pane took without touching the transcript", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("before\n");
      result.current.syncSeen("stdout", 7);
    });
    const taken: string[] = [];
    act(() => result.current.setOutputTap((text) => taken.push(text)));
    // The pane holds these bytes; the machine still counted them, so the
    // counter runs ahead of the scrollback and only the offset moves.
    // (Stepping back INTO a live session is not a case to model: the
    // snapshot ring is paused for the whole of one.)
    act(() => {
      result.current.appendStdout("session bytes\n");
      result.current.syncSeen("stdout", 21);
    });
    expect(taken).toEqual(["session bytes\n"]);
    expect(result.current.stdout).toBe("before\n");
    act(() => result.current.setOutputTap(null));
    act(() => {
      result.current.appendStdout("after\n");
      result.current.syncSeen("stdout", 27);
    });
    expect(result.current.stdout).toBe("before\nafter\n");
  });

  it("tracks stdout and stderr apart", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("out\n");
      result.current.appendStderr("err\n");
      result.current.syncSeen("stdout", 4);
      result.current.syncSeen("stderr", 4);
    });
    act(() => result.current.syncSeen("stderr", 0));
    expect(result.current.stdout).toBe("out\n");
    expect(result.current.stderr).toBe("");
  });
});

describe("useConsoleOutput preserved history", () => {
  // The tool-build case: `gcc foo.s` resets the machine's display counters
  // underneath the editor's console, and the scrollback the student was
  // reading must survive the reset-to-zero sync that follows.
  it("keeps preserved scrollback through a counter restart at zero", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("previous program\n");
      result.current.syncSeen("stdout", 17);
    });
    act(() => {
      result.current.preserveScrollback();
      result.current.syncSeen("stdout", 0);
    });
    expect(result.current.stdout).toBe("previous program\n");
  });

  it("unprints only the new session's bytes, never into history", () => {
    const { result } = mount();
    act(() => {
      result.current.appendStdout("old session\n");
      result.current.syncSeen("stdout", 12);
      result.current.preserveScrollback();
      result.current.syncSeen("stdout", 0);
    });
    // A fresh session prints on top of the history, then steps back past
    // its own start: the cut stops at the history boundary.
    act(() => {
      result.current.appendStdout("new: 42\n");
      result.current.syncSeen("stdout", 8);
    });
    act(() => result.current.syncSeen("stdout", 5));
    expect(result.current.stdout).toBe("old session\nnew: ");
    act(() => result.current.syncSeen("stdout", 0));
    expect(result.current.stdout).toBe("old session\n");
  });

  it("charges a truncation against history before moving the byte anchor", () => {
    const { result } = mount();
    const history = "h".repeat(MAX_CONSOLE_CHARS - 10);
    act(() => {
      result.current.appendStdout(history);
      result.current.syncSeen("stdout", history.length);
      result.current.preserveScrollback();
      result.current.syncSeen("stdout", 0);
    });
    // The append pushes 30 machine bytes; 20 history chars fall off the
    // head to make room. Dropped history is web text, so the machine
    // coordinates still start at zero and a full unprint empties exactly
    // the machine's bytes.
    act(() => {
      result.current.appendStdout("m".repeat(30));
      result.current.syncSeen("stdout", 30);
    });
    expect(result.current.stdout).toBe(
      CONSOLE_TRIM_MARKER + "h".repeat(MAX_CONSOLE_CHARS - 30) + "m".repeat(30),
    );
    act(() => result.current.syncSeen("stdout", 0));
    expect(result.current.stdout).toBe(
      CONSOLE_TRIM_MARKER + "h".repeat(MAX_CONSOLE_CHARS - 30),
    );
  });
});
