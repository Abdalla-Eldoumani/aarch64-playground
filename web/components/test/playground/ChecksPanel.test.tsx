// pins the checks panel: adding and editing a check through labelled fields,
// a run's verdicts (pass, a pass that needed the trailing-whitespace
// allowance, the first differing line clipped around where it differs, how a
// run ended early, a wrong exit code) announced in one status line and never
// shown on a check the run did not see, a program that does not assemble
// reported instead of any verdict, filling the expected output from a run
// without undoing changes made while it ran, the share link's size cap on
// stdin and expected output, and where focus goes after a remove.
// The runner is mocked; its own suite runs the real emulator.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";
import type { ChecksRun } from "@/lib/playground/check-runner";
import type { ProgramCheck } from "@/lib/playground/program-checks";
import { ChecksPanel } from "@/components/playground/ChecksPanel";

const runner = vi.hoisted(() => ({ runChecks: vi.fn() }));
vi.mock("@/lib/playground/check-runner", () => runner);

afterEach(() => {
  cleanup();
  runner.runChecks.mockReset();
});

function outcome(over: Partial<HiddenRunOutcome> = {}): HiddenRunOutcome {
  return {
    assembleError: null,
    error: null,
    errorLine: null,
    finished: true,
    stdout: "",
    exitCode: 0,
    stackBalanced: true,
    frameIntact: true,
    frameNotes: [],
    ...over,
  };
}

function answer(result: ChecksRun) {
  runner.runChecks.mockResolvedValue(result);
}

/** A run that waits until the test says how it ended. */
function answerLater(): (result: ChecksRun) => void {
  let finish: (result: ChecksRun) => void = () => {};
  runner.runChecks.mockReturnValue(new Promise<ChecksRun>((resolve) => (finish = resolve)));
  return (result) => finish(result);
}

const WORKSPACE = { main: "main: ret", extras: [{ name: "lib.s", body: "ret" }] };
const FILES = { "input.txt": "7\n" };
const IGNORE = () => {};

function Harness({ start = [] as ProgramCheck[], onChange = IGNORE as (next: ProgramCheck[]) => void }) {
  const [checks, setChecks] = useState(start);
  useEffect(() => onChange(checks), [checks, onChange]);
  return <ChecksPanel checks={checks} onChange={setChecks} workspace={WORKSPACE} workingFiles={() => FILES} />;
}

const status = () => screen.getByRole("status").textContent;
const blank = (name: string): ProgramCheck => ({ name, stdin: "", args: "", stdout: "" });

describe("ChecksPanel", () => {
  it("starts empty, with run checks off until a check exists", () => {
    render(<Harness />);
    expect(screen.getByText("No checks yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "run checks" })).toHaveProperty("disabled", true);
  });

  it("adds a check opened for editing, every field labelled", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "add check" }));
    fireEvent.change(screen.getByLabelText("stdin"), { target: { value: "3\n" } });
    fireEvent.change(screen.getByLabelText("args (after the program name)"), { target: { value: "-n 2" } });
    fireEvent.change(screen.getByLabelText("expected output"), { target: { value: "6\n" } });
    fireEvent.change(screen.getByLabelText("exit code (optional)"), { target: { value: "4" } });
    expect(onChange).toHaveBeenLastCalledWith([
      { name: "check 1", stdin: "3\n", args: "-n 2", stdout: "6\n", exitCode: 4 },
    ]);
    fireEvent.change(screen.getByLabelText("exit code (optional)"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: "check 1", stdin: "3\n", args: "-n 2", stdout: "6\n" }]);
    expect(screen.getByRole("button", { name: "close check 1" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("name").getAttribute("maxlength")).toBe("100");
  });

  it("runs every check against the workspace and its files and reports each verdict", async () => {
    const checks: ProgramCheck[] = [
      { name: "exact", stdin: "", args: "", stdout: "ok\n" },
      { name: "loose", stdin: "", args: "", stdout: "ok\n" },
      { name: "wrong", stdin: "", args: "", stdout: "a\nb\n" },
      { name: "exit", stdin: "", args: "", stdout: "", exitCode: 0 },
    ];
    answer({
      kind: "ran",
      outcomes: [
        outcome({ stdout: "ok\n" }),
        outcome({ stdout: "ok  \n\n" }),
        outcome({ stdout: "a\nc\n", exitCode: 1 }),
        outcome({ exitCode: 3 }),
      ],
    });
    render(<Harness start={checks} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(status()).toBe("2 of 4 checks pass"));
    expect(runner.runChecks).toHaveBeenCalledWith(WORKSPACE, checks, FILES);
    expect(screen.getAllByText("passes")).toHaveLength(1);
    expect(screen.getByText("passes, ignoring trailing whitespace")).toBeTruthy();
    expect(screen.getByText("wrong output")).toBeTruthy();
    expect(screen.getByText("first difference, line 2")).toBeTruthy();
    expect(screen.getByText('"b"')).toBeTruthy();
    expect(screen.getByText('"c"')).toBeTruthy();
    expect(screen.getByText("exit code 1")).toBeTruthy();
    expect(screen.getByText("exit code 3, expected 0")).toBeTruthy();
    expect(screen.getAllByText("passed")).toHaveLength(2);
    expect(screen.getAllByText("failed")).toHaveLength(2);
  });

  it("clips a long differing line", async () => {
    answer({ kind: "ran", outcomes: [outcome({ stdout: "y".repeat(5000) })] });
    render(<Harness start={[{ name: "a", stdin: "", args: "", stdout: "ok" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(screen.getByText("wrong output")).toBeTruthy());
    expect(screen.getByText(`"${"y".repeat(200)}..."`)).toBeTruthy();
  });

  it("clips both differing lines to where they part", async () => {
    const shared = "a".repeat(250);
    answer({ kind: "ran", outcomes: [outcome({ stdout: `${shared}${"c".repeat(50)}` })] });
    render(<Harness start={[{ name: "a", stdin: "", args: "", stdout: `${shared}${"b".repeat(50)}` }]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(screen.getByText("wrong output")).toBeTruthy());
    expect(screen.getByText(`"...${"a".repeat(40)}${"b".repeat(50)}"`)).toBeTruthy();
    expect(screen.getByText(`"...${"a".repeat(40)}${"c".repeat(50)}"`)).toBeTruthy();
  });

  it("says how a run ended early, with a crash as the runner located it", async () => {
    const checks: ProgramCheck[] = ["a", "b"].map(blank);
    answer({
      kind: "ran",
      outcomes: [
        // The runner has already turned combined line 3 into lib.s line 1.
        outcome({ error: "lib.s line 1: segmentation fault at 0x0", errorLine: 3, exitCode: null }),
        outcome({ finished: false, exitCode: null }),
      ],
    });
    render(<Harness start={checks} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(status()).toBe("0 of 2 checks pass"));
    expect(screen.getByText("crashed: lib.s line 1: segmentation fault at 0x0")).toBeTruthy();
    expect(screen.getByText("did not finish within 5,000,000 steps")).toBeTruthy();
  });

  it("reports a program that does not assemble and grades nothing", async () => {
    answer({ kind: "assemble-error", message: "lib.s line 1: unknown mnemonic" });
    render(<Harness start={[blank("a")]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(status()).toBe("the program does not assemble, so no check ran"));
    expect(screen.getByText("lib.s line 1: unknown mnemonic")).toBeTruthy();
    expect(screen.queryByText("passed")).toBeNull();
    expect(screen.queryByText("failed")).toBeNull();
  });

  it("hides a result once its check is edited, and stops counting it", async () => {
    answer({ kind: "ran", outcomes: [outcome({ stdout: "1\n" })] });
    render(<Harness start={[{ name: "a", stdin: "", args: "", stdout: "1\n" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(screen.getByText("passes")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.change(screen.getByLabelText("expected output"), { target: { value: "2\n" } });
    expect(screen.queryByText("passes")).toBeNull();
    expect(status()).toBe("");
  });

  it("shows no old verdict on a check added after the list was replaced", async () => {
    answer({ kind: "ran", outcomes: [outcome()] });
    const onChange = vi.fn();
    const panel = (checks: ProgramCheck[]) => (
      <ChecksPanel checks={checks} onChange={onChange} workspace={WORKSPACE} workingFiles={() => FILES} />
    );
    const { rerender } = render(panel([]));
    const addBlank = () => {
      fireEvent.click(screen.getByRole("button", { name: "add check" }));
      rerender(panel(onChange.mock.lastCall![0]));
    };
    addBlank();
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(status()).toBe("1 of 1 check passes"));
    // The list is emptied from outside with no remount, so only identity can
    // keep the old verdict off the new blank check.
    rerender(panel([]));
    addBlank();
    expect(screen.getByText("check 1")).toBeTruthy();
    expect(screen.queryByText("passed")).toBeNull();
    expect(status()).toBe("");
  });

  it("fills the expected output from a run, with the exit status as $? shows it", async () => {
    answer({ kind: "ran", outcomes: [outcome({ stdout: "hello\n", exitCode: -1 })] });
    const onChange = vi.fn();
    render(<Harness start={[{ name: "a", stdin: "x", args: "", stdout: "" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.click(screen.getByRole("button", { name: "fill expected output from a run" }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([{ name: "a", stdin: "x", args: "", stdout: "hello\n" }]),
    );
    expect(runner.runChecks).toHaveBeenCalledWith(WORKSPACE, [{ name: "a", stdin: "x", args: "", stdout: "" }], FILES);
    expect(status()).toBe("filled with the program's output (it exited with 255)");
    expect((screen.getByLabelText("expected output") as HTMLTextAreaElement).value).toBe("hello\n");
  });

  it("keeps a removal and an addition made while a fill runs", async () => {
    const finish = answerLater();
    const onChange = vi.fn();
    render(<Harness start={[blank("a"), blank("b")]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.click(screen.getByRole("button", { name: "fill expected output from a run" }));
    fireEvent.click(screen.getByRole("button", { name: "remove b" }));
    fireEvent.click(screen.getByRole("button", { name: "add check" }));
    finish({ kind: "ran", outcomes: [outcome({ stdout: "1\n" })] });
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([{ ...blank("a"), stdout: "1\n" }, blank("check 2")]),
    );
  });

  it("leaves a check alone when it was edited while its fill ran", async () => {
    const finish = answerLater();
    const onChange = vi.fn();
    render(<Harness start={[blank("a")]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.click(screen.getByRole("button", { name: "fill expected output from a run" }));
    fireEvent.change(screen.getByLabelText("stdin"), { target: { value: "5\n" } });
    finish({ kind: "ran", outcomes: [outcome({ stdout: "1\n" })] });
    await waitFor(() => expect(status()).toBe("the check changed while the program ran, so nothing was filled"));
    expect(onChange).toHaveBeenLastCalledWith([{ ...blank("a"), stdin: "5\n" }]);
  });

  it("holds stdin and expected output to the size a share link carries", async () => {
    const over = "x".repeat(100 * 1024 + 1);
    answer({ kind: "ran", outcomes: [outcome({ stdout: over })] });
    const onChange = vi.fn();
    render(<Harness start={[blank("a")]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.change(screen.getByLabelText("stdin"), { target: { value: over } });
    const note = screen.getByText("over 100 KiB, too long for a share link to carry");
    expect(screen.getByLabelText("stdin").getAttribute("aria-describedby")).toBe(note.id);
    fireEvent.click(screen.getByRole("button", { name: "fill expected output from a run" }));
    await waitFor(() =>
      expect(status()).toBe(
        "the program printed over 100 KiB, too long for a share link to carry, so nothing was filled",
      ),
    );
    expect(onChange).toHaveBeenLastCalledWith([{ ...blank("a"), stdin: over }]);
  });

  it("removes a check and moves focus to the next, the previous, then add check", () => {
    // Removes inside the double-press interval of the last one are ignored.
    let now = 1000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      const onChange = vi.fn();
      render(<Harness start={[blank("a"), blank("b"), blank("c")]} onChange={onChange} />);
      fireEvent.click(screen.getByRole("button", { name: "remove b" }));
      expect(onChange).toHaveBeenLastCalledWith([blank("a"), blank("c")]);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "edit c" }));
      // A double press's second click lands on the remove button that slid up.
      fireEvent.click(screen.getByRole("button", { name: "remove c" }));
      expect(onChange).toHaveBeenLastCalledWith([blank("a"), blank("c")]);
      // Past the interval, a click the browser counts as a second one is still ignored.
      now += 600;
      fireEvent.click(screen.getByRole("button", { name: "remove c" }), { detail: 2 });
      expect(onChange).toHaveBeenLastCalledWith([blank("a"), blank("c")]);
      fireEvent.click(screen.getByRole("button", { name: "remove c" }));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "edit a" }));
      now += 600;
      fireEvent.click(screen.getByRole("button", { name: "remove a" }));
      expect(onChange).toHaveBeenLastCalledWith([]);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "add check" }));
    } finally {
      clock.mockRestore();
    }
  });

  it("says so when the emulator cannot load", async () => {
    runner.runChecks.mockRejectedValue(new Error("offline"));
    render(<Harness start={[blank("a")]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() =>
      expect(status()).toBe("the emulator did not load, so nothing ran. reload the page and try again"),
    );
  });
});
