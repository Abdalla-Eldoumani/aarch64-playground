// pins the checks panel: adding and editing a check through labelled fields,
// a run's verdicts (pass, a pass that needed the trailing-whitespace
// allowance, the first differing line, how a run ended early, a wrong exit
// code) announced in one status line, a program that does not assemble
// reported instead of any verdict, and filling the expected output from a run.
// The runner is mocked; its own suite runs the real emulator.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { HiddenRunOutcome } from "@/lib/content/exercise-checker";
import type { ChecksRun } from "@/lib/playground/check-runner";
import type { ProgramCheck } from "@/lib/playground/program-checks";
import { ChecksPanel } from "@/components/playground/ChecksPanel";

const runner = vi.hoisted(() => ({
  runChecks: vi.fn(),
  machineForChecks: vi.fn(),
}));
vi.mock("@/lib/playground/check-runner", () => runner);

afterEach(() => {
  cleanup();
  runner.runChecks.mockReset();
  runner.machineForChecks.mockReset();
});

function outcome(over: Partial<HiddenRunOutcome> = {}): HiddenRunOutcome {
  return {
    assembleError: null,
    error: null,
    finished: true,
    waiting: false,
    stdout: "",
    exitCode: 0,
    stackBalanced: true,
    frameIntact: true,
    ...over,
  };
}

function answer(result: ChecksRun) {
  runner.machineForChecks.mockResolvedValue({});
  runner.runChecks.mockResolvedValue(result);
}

const WORKSPACE = { main: "main: ret", extras: [{ name: "lib.s", body: "ret" }] };

function Harness({ start = [] as ProgramCheck[], onChange = (_: ProgramCheck[]) => {} }) {
  const [checks, setChecks] = useState(start);
  return (
    <ChecksPanel
      checks={checks}
      onChange={(next) => {
        setChecks(next);
        onChange(next);
      }}
      workspace={WORKSPACE}
    />
  );
}

const status = () => screen.getByRole("status").textContent;

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
  });

  it("runs every check against the workspace and reports each verdict", async () => {
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
    expect(runner.runChecks).toHaveBeenCalledWith({}, WORKSPACE, checks);
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

  it("says how a run ended early", async () => {
    const checks: ProgramCheck[] = ["a", "b", "c"].map((name) => ({ name, stdin: "", args: "", stdout: "" }));
    answer({
      kind: "ran",
      outcomes: [
        outcome({ error: "segmentation fault at 0x0", exitCode: null }),
        outcome({ finished: false, exitCode: null }),
        outcome({ finished: false, waiting: true, exitCode: null }),
      ],
    });
    render(<Harness start={checks} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(status()).toBe("0 of 3 checks pass"));
    expect(screen.getByText("crashed: segmentation fault at 0x0")).toBeTruthy();
    expect(screen.getByText("did not finish within 5,000,000 steps")).toBeTruthy();
    expect(screen.getByText("stopped waiting for input it never got")).toBeTruthy();
  });

  it("reports a program that does not assemble and grades nothing", async () => {
    answer({ kind: "assemble-error", message: "lib.s line 1: unknown mnemonic" });
    render(<Harness start={[{ name: "a", stdin: "", args: "", stdout: "" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(status()).toBe("the program does not assemble, so no check ran"));
    expect(screen.getByText("lib.s line 1: unknown mnemonic")).toBeTruthy();
    expect(screen.queryByText("passed")).toBeNull();
    expect(screen.queryByText("failed")).toBeNull();
  });

  it("hides a result once its check is edited", async () => {
    answer({ kind: "ran", outcomes: [outcome({ stdout: "1\n" })] });
    render(<Harness start={[{ name: "a", stdin: "", args: "", stdout: "1\n" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() => expect(screen.getByText("passes")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.change(screen.getByLabelText("expected output"), { target: { value: "2\n" } });
    expect(screen.queryByText("passes")).toBeNull();
  });

  it("fills the expected output from a run of the program", async () => {
    answer({ kind: "ran", outcomes: [outcome({ stdout: "hello\n", exitCode: 0 })] });
    const onChange = vi.fn();
    render(<Harness start={[{ name: "a", stdin: "x", args: "", stdout: "" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "edit a" }));
    fireEvent.click(screen.getByRole("button", { name: "fill expected output from a run" }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([{ name: "a", stdin: "x", args: "", stdout: "hello\n" }]),
    );
    expect(status()).toBe("filled with the program's output (it exited with 0)");
    expect((screen.getByLabelText("expected output") as HTMLTextAreaElement).value).toBe("hello\n");
  });

  it("removes a check", () => {
    const onChange = vi.fn();
    render(
      <Harness
        start={[
          { name: "a", stdin: "", args: "", stdout: "" },
          { name: "b", stdin: "", args: "", stdout: "" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "remove a" }));
    expect(onChange).toHaveBeenLastCalledWith([{ name: "b", stdin: "", args: "", stdout: "" }]);
  });

  it("says so when the emulator cannot load", async () => {
    runner.machineForChecks.mockRejectedValue(new Error("offline"));
    render(<Harness start={[{ name: "a", stdin: "", args: "", stdout: "" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "run checks" }));
    await waitFor(() =>
      expect(status()).toBe("the emulator did not load, so nothing ran. reload the page and try again"),
    );
  });
});
