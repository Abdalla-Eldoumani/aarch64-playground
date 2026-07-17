import { describe, expect, it } from "vitest";
import { TerminalInputState, sanitizeInput, splitPasteLines } from "@/lib/terminal/input-state";

describe("splitPasteLines", () => {
  it("splits the bare carriage returns xterm delivers for pasted line breaks", () => {
    // The regression this guards: xterm normalizes every pasted \n and
    // \r\n to \r before onData, so a \n-only split joined a multi-line
    // paste into one command line ("cat a.txt cp a.txt b.txt ...").
    expect(splitPasteLines("cat a.txt\rcp a.txt b.txt\rls")).toEqual([
      "cat a.txt",
      "cp a.txt b.txt",
      "ls",
    ]);
  });

  it("splits unix and windows line endings the same way", () => {
    expect(splitPasteLines("one\ntwo\r\nthree")).toEqual(["one", "two", "three"]);
  });

  it("a trailing line break yields an empty final chunk, submitting the last command", () => {
    expect(splitPasteLines("ls -l\r")).toEqual(["ls -l", ""]);
  });

  it("passes a single-line paste through untouched", () => {
    expect(splitPasteLines("gdb p $x0")).toEqual(["gdb p $x0"]);
  });
});

describe("sanitizeInput", () => {
  it("removes whole escape sequences, not just the ESC byte", () => {
    // A pasted colored shell transcript carries full SGR sequences; the
    // sequence must go as a unit or "[32m" survives as literal text.
    expect(sanitizeInput("\x1b[32mhello\x1b[0m")).toBe("hello");
    expect(sanitizeInput("ls\x1b[A")).toBe("ls");
    expect(sanitizeInput("\x1bOP")).toBe("");
  });

  it("removes stray C0 and C1 control bytes", () => {
    expect(sanitizeInput("a\x07b\x9cc")).toBe("abc");
    expect(sanitizeInput("del\x7f")).toBe("del");
  });

  it("turns tabs into spaces so token separation survives", () => {
    expect(sanitizeInput("ls\t-l")).toBe("ls -l");
  });

  it("passes ordinary command text through untouched", () => {
    expect(sanitizeInput("gcc prog.s -o prog")).toBe("gcc prog.s -o prog");
    expect(sanitizeInput("gdb x/4i $pc [sp]")).toBe("gdb x/4i $pc [sp]");
  });
});

describe("TerminalInputState", () => {
  it("keeps escape sequences out of the buffer", () => {
    // xterm fires onData with "\x1b[A" for ArrowUp; if that reaches the
    // buffer it is invisible on screen but corrupts the submission.
    const s = new TerminalInputState();
    s.handlePrintable("ls");
    s.handlePrintable("\x1b[A");
    expect(s.buffer).toBe("ls");
    expect(s.takeSubmission()).toBe("ls");
  });

  it("appends printable characters to the buffer", () => {
    const s = new TerminalInputState();
    s.handlePrintable("l");
    s.handlePrintable("s");
    expect(s.buffer).toBe("ls");
    expect(s.cursor).toBe(2);
  });

  it("backspace removes the character before the cursor", () => {
    const s = new TerminalInputState();
    s.handlePrintable("a");
    s.handlePrintable("b");
    s.handlePrintable("c");
    s.handleBackspace();
    expect(s.buffer).toBe("ab");
    expect(s.cursor).toBe(2);
  });

  it("backspace at the start is a no-op", () => {
    const s = new TerminalInputState();
    s.handleBackspace();
    expect(s.buffer).toBe("");
  });

  it("up arrow navigates back through history", () => {
    const s = new TerminalInputState();
    s.commit("ls");
    s.commit("cat foo");
    s.handlePrintable("p");           // start typing the next command
    s.handleUp();                     // pull most recent
    expect(s.buffer).toBe("cat foo");
    s.handleUp();                     // pull the older one
    expect(s.buffer).toBe("ls");
  });

  it("down arrow returns toward the in-progress edit", () => {
    const s = new TerminalInputState();
    s.commit("ls");
    s.commit("cat foo");
    s.handlePrintable("p");
    s.handleUp();                     // cat foo
    s.handleUp();                     // ls
    s.handleDown();                   // cat foo
    expect(s.buffer).toBe("cat foo");
    s.handleDown();                   // back to in-progress edit
    expect(s.buffer).toBe("p");
  });

  it("commit clears the buffer and pushes onto history", () => {
    const s = new TerminalInputState();
    s.handlePrintable("l");
    s.handlePrintable("s");
    const submitted = s.takeSubmission();
    expect(submitted).toBe("ls");
    expect(s.buffer).toBe("");
    expect(s.cursor).toBe(0);
    expect(s.history).toEqual(["ls"]);
  });

  it("commit ignores empty submissions", () => {
    const s = new TerminalInputState();
    expect(s.takeSubmission()).toBe(null);
    expect(s.history).toEqual([]);
  });

  it("commit collapses repeated identical entries", () => {
    const s = new TerminalInputState();
    s.commit("ls");
    s.commit("ls");
    expect(s.history).toEqual(["ls"]);
  });

  it("tab completion expands a single matching VFS file name", () => {
    const s = new TerminalInputState();
    s.handlePrintable("c");
    s.handlePrintable("a");
    s.handlePrintable("t");
    s.handlePrintable(" ");
    s.handlePrintable("i");
    s.handleTab(["input.txt", "output.txt"]);
    expect(s.buffer).toBe("cat input.txt");
  });

  it("tab completion lists candidates when the prefix is ambiguous", () => {
    const s = new TerminalInputState();
    s.handlePrintable("l");
    s.handlePrintable("s");
    s.handlePrintable(" ");
    s.handlePrintable("a");
    const completions = s.handleTab(["a.txt", "ab.txt", "ac.txt"]);
    expect(completions).toEqual(["a.txt", "ab.txt", "ac.txt"]);
    // Buffer doesn't change when ambiguous, but the longest common prefix
    // for the candidates is "a"; we keep what the user typed and let the
    // caller list the candidates.
    expect(s.buffer).toBe("ls a");
  });

  it("tab completion is a no-op when nothing matches", () => {
    const s = new TerminalInputState();
    s.handlePrintable("c");
    s.handlePrintable("a");
    s.handlePrintable("t");
    s.handlePrintable(" ");
    s.handlePrintable("z");
    const completions = s.handleTab(["a.txt"]);
    expect(completions).toEqual([]);
    expect(s.buffer).toBe("cat z");
  });
});
