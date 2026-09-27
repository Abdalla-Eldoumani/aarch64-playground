import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act, forwardRef, useEffect, useImperativeHandle, type Ref } from "react";
import type { Exercise } from "@/lib/content/exercise-schema";
import type { CheckResult } from "@/lib/content/exercise-checker";
import { checkExercise, checkHiddenCase } from "@/lib/content/exercise-checker";
import { runHeadless } from "@/lib/emulator/headless-run";
import { markSolved } from "@/lib/playground/solved-state";
import { readShareHash } from "@/lib/playground/share";

// readShareHash returns a discriminated verdict; these tests only
// care about the ok payload.
function okShareState(hash: string) {
  const r = readShareHash(hash);
  if (r.kind !== "ok") throw new Error(`expected ok, got ${r.kind}`);
  return r.state;
}
import { MAX_STDIN_BYTES } from "@/lib/playground/upload-guard";

// Shared between the embed mock and the assertions: the snapshot the embed
// hands the checker, and the live source its getSource() returns. vi.hoisted so
// they exist when the (hoisted) mock factory runs.
const { MOCK_SNAPSHOT, MOCK_SOURCE, TYPED_SOURCE, LOADED } = vi.hoisted(() => ({
  TYPED_SOURCE: "// what the student typed\n        mov     x0, 7",
  LOADED: [] as string[],
  MOCK_SNAPSHOT: {
    registers: Array.from({ length: 31 }, () => "0x0000000000000000"),
    sp: "0x0000000000000000",
    pc: 0,
    nzcv: 0,
    stdout: "",
    stderr: "",
    exitCode: 0,
    isRunning: false,
    isHalted: true,
    error: null,
  },
  MOCK_SOURCE: "// the live student source\n        mov     x0, 1\n        ret",
}));

// Stub the shared embed with a light marker that echoes the props the view
// feeds it (so a dropped stdin shows as a missing data-startstdin), exposes
// getSource() through the ref, and renders a check button that fires onCheck
// with the mock snapshot. Never instantiates Monaco or the WASM worker.
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: forwardRef(function MockEmbed(
    props: {
      chrome?: string;
      startSource?: string;
      startArgs?: string;
      startStdin?: string;
      showArgs?: boolean;
      onCheck?: (snapshot: unknown) => void;
      onSourceChange?: (source: string) => void;
    },
    ref: Ref<{ getSource: () => string; loadSource: (source: string) => void }>,
  ) {
    useImperativeHandle(
      ref,
      () => ({
        getSource: () => MOCK_SOURCE,
        loadSource: (source: string) => {
          LOADED.push(source);
        },
      }),
      [],
    );
    // The real embed echoes its buffer once on mount, before any edit.
    const echo = props.onSourceChange;
    const start = props.startSource ?? "";
    useEffect(() => {
      echo?.(start);
    }, [echo, start]);
    return (
      <div
        data-testid="embed"
        data-chrome={props.chrome}
        data-startsource={props.startSource}
        data-startargs={props.startArgs}
        data-startstdin={props.startStdin}
        data-showargs={props.showArgs ? "1" : undefined}
      >
        <button type="button" onClick={() => props.onCheck?.(MOCK_SNAPSHOT)}>
          check
        </button>
        <button type="button" onClick={() => props.onSourceChange?.(TYPED_SOURCE)}>
          type
        </button>
      </div>
    );
  }),
}));

vi.mock("@/lib/content/exercise-checker", () => ({
  checkExercise: vi.fn(),
  checkHiddenCase: vi.fn(),
}));
// The hidden inputs run on a machine of their own; neither the wasm nor the
// runner loads here, so each test decides what a hidden run reports.
vi.mock("@/lib/emulator/emulator", () => ({ loadEmulator: vi.fn(async () => ({})) }));
vi.mock("@/lib/emulator/headless-run", () => ({ runHeadless: vi.fn() }));
vi.mock("@/lib/playground/solved-state", () => ({ markSolved: vi.fn() }));

import { ExerciseView } from "@/components/practice/ExerciseView";

const checkExerciseMock = vi.mocked(checkExercise);
const checkHiddenCaseMock = vi.mocked(checkHiddenCase);
const runHeadlessMock = vi.mocked(runHeadless);
const markSolvedMock = vi.mocked(markSolved);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  LOADED.length = 0;
});

const ANSWER_KEY = (slug: string) => `aarch64-playground:practice:answer:${slug}`;

/** The raw stored record, so a test can assert the stamp as well as the work. */
function storedAnswer(slug: string): { kind: string; source?: string; updatedAt: number } | null {
  const raw = window.localStorage.getItem(ANSWER_KEY(slug));
  return raw === null ? null : JSON.parse(raw);
}

function saveSource(slug: string, source: string, updatedAt: number): void {
  window.localStorage.setItem(
    ANSWER_KEY(slug),
    JSON.stringify({ version: 1, kind: "write", source, updatedAt }),
  );
}

const writeExercise: Exercise = {
  title: "Write Exercise",
  slug: "write-exercise",
  order: 1,
  prompt: "## the task\n\nthe prompt body text here",
  starter: "// starter program\nret",
  variant: "write",
  acceptance: {
    results: [
      { kind: "register", reg: "x0", equals: 55 },
      { kind: "exit", equals: 0 },
      { kind: "stdout", equals: "sum = 55\n" },
    ],
    structural: [
      { kind: "uses-instruction", mnemonic: "b.lt" },
      { kind: "forbids-literal", value: 55 },
    ],
  },
};

const bugExercise: Exercise = {
  ...writeExercise,
  slug: "bug-exercise",
  variant: "identify-bug",
};

const passResult: CheckResult = {
  pass: true,
  results: [],
  structural: [],
  summary: "all checks passed",
};

const failResult: CheckResult = {
  pass: false,
  results: [
    {
      assertion: { kind: "register", reg: "x0", equals: 55 },
      pass: false,
      expected: "55",
      actual: "42",
    },
  ],
  structural: [{ assertion: { kind: "forbids-literal", value: 55 }, pass: false }],
  summary: "1 of 2 checks passing",
};

describe("ExerciseView", () => {
  it("renders the prompt through the real LessonMarkdown", () => {
    render(<ExerciseView exercise={writeExercise} />);
    // A real h2 from the prompt markdown proves it rendered through LessonMarkdown.
    expect(screen.getByRole("heading", { name: /the task/i, level: 2 })).toBeTruthy();
    expect(screen.getByText(/the prompt body text here/i)).toBeTruthy();
  });

  it("renders a shape-only specification table and never the expected values", () => {
    render(<ExerciseView exercise={writeExercise} />);
    const criteria = screen.getByRole("region", { name: /specification/i });
    const text = criteria.textContent ?? "";
    expect(text).toContain("leaves the right value in x0");
    expect(text).toContain("exits with the right code");
    expect(text).toContain("prints the right output");
    expect(text).toContain("uses b.lt");
    expect(text).toContain("computes the result (does not hardcode it)");
    // The expected register value and the expected stdout must never appear.
    expect(text).not.toContain("55");
    expect(text).not.toContain("sum = 55");
  });

  it("links to the playground with the starter, args, and stdin payload", () => {
    const exercise: Exercise = {
      ...writeExercise,
      args: "3 4",
      stdin: "7\n",
    };
    render(<ExerciseView exercise={exercise} />);
    const link = screen.getByRole("link", { name: /open in playground/i });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/playground#p2=")).toBe(true);
    const decoded = okShareState(href.slice("/playground".length));
    expect(decoded).toEqual({
      source: "// starter program\nret",
      args: "3 4",
      stdin: "7\n",
    });
  });

  it("drops an oversize stdin from the playground link", () => {
    const exercise: Exercise = {
      ...writeExercise,
      stdin: "x".repeat(MAX_STDIN_BYTES + 1),
    };
    render(<ExerciseView exercise={exercise} />);
    const link = screen.getByRole("link", { name: /open in playground/i });
    const decoded = okShareState(
      (link.getAttribute("href") ?? "").slice("/playground".length),
    );
    expect(decoded).toEqual({ source: "// starter program\nret" });
  });

  it("renders the identify-bug framing banner only for that variant", () => {
    const { unmount } = render(<ExerciseView exercise={bugExercise} />);
    expect(screen.getByText(/this program is broken/i)).toBeTruthy();
    unmount();

    render(<ExerciseView exercise={writeExercise} />);
    expect(screen.queryByText(/this program is broken/i)).toBeNull();
  });

  it("on a passing check shows the pass state, marks solved, and checks the live source", () => {
    checkExerciseMock.mockReturnValue(passResult);
    render(<ExerciseView exercise={writeExercise} />);

    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(checkExerciseMock).toHaveBeenCalledWith(
      writeExercise.acceptance,
      MOCK_SNAPSHOT,
      MOCK_SOURCE,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("all checks passed");
    expect(markSolvedMock).toHaveBeenCalledWith("write-exercise");
  });

  it("on a failing check shows expected-vs-actual, the failed structural label, and does not mark solved", () => {
    checkExerciseMock.mockReturnValue(failResult);
    render(<ExerciseView exercise={writeExercise} />);

    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("leaves the right value in x0");
    expect(status.textContent).toContain("expected 55, got 42");
    expect(status.textContent).toContain(
      "computes the result (does not hardcode it): the value 55 appears literally in your program",
    );
    expect(markSolvedMock).not.toHaveBeenCalled();
  });

  it("forwards an in-cap stdin to the embed and drops an oversize one", () => {
    const withStdin: Exercise = { ...writeExercise, slug: "stdin-ok", stdin: "queued input" };
    const { unmount } = render(<ExerciseView exercise={withStdin} />);
    expect(screen.getByTestId("embed").getAttribute("data-startstdin")).toBe("queued input");
    unmount();

    const oversize = "x".repeat(MAX_STDIN_BYTES + 1);
    const tooBig: Exercise = { ...writeExercise, slug: "stdin-oversize", stdin: oversize };
    render(<ExerciseView exercise={tooBig} />);
    const embed = screen.getByTestId("embed");
    // Dropped: no stdin forwarded, but the starter source still is.
    expect(embed.getAttribute("data-startstdin")).toBeNull();
    expect(embed.getAttribute("data-startsource")).toBe("// starter program\nret");
  });
});

describe("ExerciseView saved answers", () => {
  const MY_WORK = "// my work\n        ret";

  it("opens with the answer saved for this slug", () => {
    saveSource("write-exercise", MY_WORK, 5);
    render(<ExerciseView exercise={writeExercise} />);
    expect(screen.getByTestId("embed").getAttribute("data-startsource")).toBe(MY_WORK);
  });

  it("opens with the starter when nothing is saved", () => {
    render(<ExerciseView exercise={writeExercise} />);
    expect(screen.getByTestId("embed").getAttribute("data-startsource")).toBe(
      writeExercise.starter,
    );
  });

  it("opens with the starter when the stored answer is malformed", () => {
    window.localStorage.setItem(ANSWER_KEY("write-exercise"), "{not json");
    render(<ExerciseView exercise={writeExercise} />);
    expect(screen.getByTestId("embed").getAttribute("data-startsource")).toBe(
      writeExercise.starter,
    );
  });

  it("saves an edited buffer once the debounce elapses", () => {
    vi.useFakeTimers();
    render(<ExerciseView exercise={writeExercise} />);

    fireEvent.click(screen.getByRole("button", { name: "type" }));
    expect(storedAnswer("write-exercise")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(storedAnswer("write-exercise")).toMatchObject({
      kind: "write",
      source: TYPED_SOURCE,
    });
  });

  it("flushes a pending edit when the sheet unmounts", () => {
    vi.useFakeTimers();
    const { unmount } = render(<ExerciseView exercise={writeExercise} />);

    fireEvent.click(screen.getByRole("button", { name: "type" }));
    unmount();

    expect(storedAnswer("write-exercise")).toMatchObject({ source: TYPED_SOURCE });
  });

  it("leaves the saved answer alone when the embed echoes it back on mount", () => {
    saveSource("write-exercise", MY_WORK, 5);
    vi.useFakeTimers();
    render(<ExerciseView exercise={writeExercise} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Same stamp: opening an exercise must not make the local copy look
    // newer than an import that really is.
    expect(storedAnswer("write-exercise")?.updatedAt).toBe(5);
  });

  it("stores nothing for a buffer that is still the starter", () => {
    vi.useFakeTimers();
    render(<ExerciseView exercise={writeExercise} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(storedAnswer("write-exercise")).toBeNull();
  });

  it("restore starter loads the starter and forgets the saved answer", () => {
    saveSource("write-exercise", MY_WORK, 5);
    vi.useFakeTimers();
    render(<ExerciseView exercise={writeExercise} />);

    fireEvent.click(screen.getByRole("button", { name: "type" }));
    fireEvent.click(screen.getByRole("button", { name: "restore starter" }));

    expect(LOADED).toEqual([writeExercise.starter]);
    expect(storedAnswer("write-exercise")).toBeNull();

    // The edit pending when restore was pressed must not write itself back.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(storedAnswer("write-exercise")).toBeNull();
  });

  it("keeps each slug's answer separate", () => {
    vi.useFakeTimers();
    const { unmount } = render(<ExerciseView exercise={writeExercise} />);
    fireEvent.click(screen.getByRole("button", { name: "type" }));
    unmount();

    render(<ExerciseView exercise={bugExercise} />);
    expect(screen.getByTestId("embed").getAttribute("data-startsource")).toBe(
      bugExercise.starter,
    );
    expect(storedAnswer("bug-exercise")).toBeNull();
  });
});

describe("ExerciseView hidden inputs", () => {
  const hiddenExercise: Exercise = {
    ...writeExercise,
    slug: "hidden-exercise",
    stdin: "10\n",
    hiddenCases: [
      { stdin: "3\n", stdout: "sum = 6\n", exitCode: 0 },
      { stdin: "0\n", stdout: "sum = 0\n", exitCode: 0, edge: true },
      { args: "7", stdout: "sum = 28\n", exitCode: 0 },
    ],
  };
  const outcome = {
    assembleError: null,
    error: null,
    finished: true,
    stdout: "",
    exitCode: 0,
    stackBalanced: true,
    frameIntact: true,
  };

  it("names how many hidden inputs there are and never what they are", () => {
    render(<ExerciseView exercise={hiddenExercise} />);
    const text = screen.getByRole("region", { name: /specification/i }).textContent ?? "";
    expect(text).toContain("3 more inputs you do not see");
    expect(text).not.toContain("sum = 6");
    expect(text).not.toContain("28");
  });

  it("runs them after the visible checks pass, shows a failing one's input, and does not mark solved", async () => {
    checkExerciseMock.mockReturnValue(passResult);
    runHeadlessMock.mockResolvedValue(outcome);
    checkHiddenCaseMock
      .mockReturnValueOnce({ pass: true, miss: null, detail: "" })
      .mockReturnValueOnce({ pass: false, miss: "stdout", detail: '"sum = 1\\n"' })
      .mockReturnValueOnce({ pass: true, miss: null, detail: "" });
    render(<ExerciseView exercise={hiddenExercise} />);

    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await screen.findByText(/hidden input 3/);
    expect(runHeadlessMock).toHaveBeenCalledTimes(3);
    // The live source and each case's own input reach the runner.
    expect(runHeadlessMock.mock.calls[0].slice(1)).toEqual([MOCK_SOURCE, [], "3\n"]);
    expect(runHeadlessMock.mock.calls[2].slice(1)).toEqual([MOCK_SOURCE, ["7"], undefined]);
    const status = screen.getByRole("status").textContent ?? "";
    expect(status).toContain('input "0\\n"');
    expect(status).toContain('it prints something else: got "sum = 1\\n"');
    expect(status).not.toContain("sum = 0");
    expect(status).not.toContain("all checks passed");
    expect(markSolvedMock).not.toHaveBeenCalled();
  });

  it("marks solved once every hidden input passes too", async () => {
    checkExerciseMock.mockReturnValue(passResult);
    runHeadlessMock.mockResolvedValue(outcome);
    checkHiddenCaseMock.mockReturnValue({ pass: true, miss: null, detail: "" });
    render(<ExerciseView exercise={hiddenExercise} />);

    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    await screen.findByText("all checks passed");
    expect(markSolvedMock).toHaveBeenCalledWith("hidden-exercise");
  });

  it("holds the hidden inputs back while the visible checks fail", () => {
    checkExerciseMock.mockReturnValue(failResult);
    render(<ExerciseView exercise={hiddenExercise} />);

    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(screen.getByRole("status").textContent).toContain(
      "3 hidden inputs run once the checks above pass",
    );
    expect(runHeadlessMock).not.toHaveBeenCalled();
  });

  it("brings the results into view in answer to a check, and only then", () => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
    try {
      checkExerciseMock.mockReturnValue(failResult);
      render(<ExerciseView exercise={writeExercise} />);
      expect(scroll).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /check/i }));

      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll.mock.contexts[0]).toBe(screen.getByRole("status"));
      expect(scroll.mock.calls[0][0]).toMatchObject({ block: "nearest" });
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("ExerciseView command line and shortcut rules", () => {
  it("gives the embed an args box only when the exercise takes arguments", () => {
    const { unmount } = render(<ExerciseView exercise={{ ...writeExercise, args: "12 7" }} />);
    expect(screen.getByTestId("embed").getAttribute("data-showargs")).toBe("1");
    unmount();

    render(<ExerciseView exercise={{ ...writeExercise, args: "" }} />);
    expect(screen.getByTestId("embed").getAttribute("data-showargs")).toBeNull();
    // An empty args row would only say there is nothing to say.
    expect(screen.getByRole("region", { name: /specification/i }).textContent).not.toContain("args");
  });

  it("names forbidden instructions and scoped checks in plain words", () => {
    const exercise: Exercise = {
      ...writeExercise,
      acceptance: {
        results: [{ kind: "exit", equals: 0 }],
        structural: [
          { kind: "forbids-instruction", mnemonics: ["mul", "madd", "msub"] },
          { kind: "uses-instruction", mnemonic: "bl fact", in: "fact" },
          { kind: "forbids-literal", value: "%lo" },
        ],
      },
    };
    render(<ExerciseView exercise={exercise} />);
    const text = screen.getByRole("region", { name: /specification/i }).textContent ?? "";
    expect(text).toContain("does not use mul, madd or msub");
    expect(text).toContain("uses bl fact in fact");
    expect(text).toContain("does not contain %lo");
  });

  it("says which forbidden instruction a failing program used", () => {
    checkExerciseMock.mockReturnValue({
      pass: false,
      results: [],
      structural: [
        {
          assertion: { kind: "forbids-instruction", mnemonics: ["mul", "madd"] },
          pass: false,
          found: "madd",
        },
      ],
      summary: "0 of 1 checks passing",
    });
    render(<ExerciseView exercise={writeExercise} />);
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByRole("status").textContent).toContain("madd appears in your program");
  });
});
