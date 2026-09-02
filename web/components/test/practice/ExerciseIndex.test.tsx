import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// Control the solved set the ROWS read: only "solved-one" is solved, and
// subscribe is a no-op. The bundle helpers stay real, so the export payload
// and the import merge are pinned against the actual store (localStorage).
vi.mock("@/lib/playground/solved-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/playground/solved-state")>();
  return {
    ...actual,
    getSolvedSlugs: () => ["solved-one"],
    subscribeSolved: () => () => {},
  };
});

const { toastError, toastSuccess, toastInfo } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
    info: toastInfo,
    show: vi.fn(),
  }),
}));

import { ExerciseIndex } from "@/components/practice/ExerciseIndex";
import type { ExerciseIndexRow } from "@/lib/content/exercise-schema";
import { MAX_BOOKMARK_JSON_BYTES, checkUploadSize } from "@/lib/playground/upload-guard";

const SOLVED_KEY = "aarch64-playground:practice:solved";

beforeEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  toastInfo.mockClear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

// The index takes the narrowed row, so the fixture is a row: the blurb
// arrives already derived from the server rather than computed here.
function makeRow(over: Partial<ExerciseIndexRow>): ExerciseIndexRow {
  return {
    title: "Sample",
    slug: "sample",
    order: 1,
    variant: "write",
    blurb: "do the thing",
    ...over,
  };
}

// order 2 then 1, so a correct render proves the order-sort; distinct topics and
// difficulties drive the filter tests; "solved-one" is the mocked-solved slug.
const exercises: ExerciseIndexRow[] = [
  makeRow({
    title: "Beta Exercise",
    slug: "unsolved-two",
    order: 2,
    topic: "stack",
    difficulty: "core",
    blurb: "work with the stack",
  }),
  makeRow({
    title: "Alpha Exercise",
    slug: "solved-one",
    order: 1,
    topic: "registers",
    difficulty: "intro",
    blurb: "work with registers",
  }),
];

describe("ExerciseIndex", () => {
  it("renders cards ordered by order, each linking to its exercise", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const hrefs = Array.from(container.querySelectorAll('a[href^="/practice/"]')).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["/practice/solved-one", "/practice/unsolved-two"]);
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.getByText("Beta Exercise")).toBeTruthy();
  });

  it("filters by the search query (title and topic) with an accessible search name", () => {
    render(<ExerciseIndex exercises={exercises} />);
    const input = screen.getByLabelText("search exercises");
    fireEvent.change(input, { target: { value: "Alpha" } });
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.queryByText("Beta Exercise")).toBeNull();
    fireEvent.change(input, { target: { value: "stack" } });
    expect(screen.getByText("Beta Exercise")).toBeTruthy();
    expect(screen.queryByText("Alpha Exercise")).toBeNull();
  });

  it("splits coding exercises and theory sets into two columns, grouped by topic in course order", () => {
    const quiz: ExerciseIndexRow = {
      title: "Loop Quiz",
      slug: "loop-quiz",
      order: 3,
      topic: "loops",
      difficulty: "intro",
      variant: "quiz",
      blurb: "check what you know",
    };
    const listedTopic = makeRow({
      title: "Gamma Exercise",
      slug: "gamma",
      order: 4,
      topic: "bitwise",
      blurb: "flip some bits",
    });
    render(<ExerciseIndex exercises={[...exercises, quiz, listedTopic]} />);

    const code = screen.getByRole("region", { name: "Coding exercises" });
    const theory = screen.getByRole("region", { name: "Theory sets" });
    expect(within(code).getByText("Gamma Exercise")).toBeTruthy();
    expect(within(code).queryByText("Loop Quiz")).toBeNull();
    expect(within(theory).getByText("Loop Quiz")).toBeTruthy();
    expect(within(theory).getByRole("heading", { name: /^loops/ })).toBeTruthy();

    // A listed topic (bitwise) groups ahead of unlisted ones, which keep
    // their id as the label and sort after the table.
    const groupNames = within(code)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => (heading.textContent ?? "").replace(/·.*$/, "").trim());
    expect(groupNames).toEqual(["bitwise", "registers", "stack"]);
    expect(screen.queryByRole("button", { name: "registers" })).toBeNull();
  });

  // The blurb comes from the server. Nothing else in the suite would notice
  // if it arrived empty, because every other assertion matches on a title or
  // a topic.
  it("renders the server-derived blurb verbatim", () => {
    render(<ExerciseIndex exercises={exercises} />);
    expect(screen.getByText("work with the stack")).toBeTruthy();
    expect(screen.getByText("work with registers")).toBeTruthy();
  });

  it("matches the search query against the blurb", () => {
    const rows = [
      makeRow({ title: "Alpha", slug: "alpha", order: 1, blurb: "tail-call elimination" }),
      makeRow({ title: "Beta", slug: "beta", order: 2, blurb: "unrelated" }),
    ];
    render(<ExerciseIndex exercises={rows} />);
    fireEvent.change(screen.getByLabelText("search exercises"), {
      target: { value: "elimination" },
    });
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("filters by a selected difficulty chip", () => {
    render(<ExerciseIndex exercises={exercises} />);
    const chip = screen.getByRole("button", { name: "intro" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Alpha Exercise")).toBeTruthy();
    expect(screen.queryByText("Beta Exercise")).toBeNull();
  });

  it("renders the empty state when there are no exercises", () => {
    const { container } = render(<ExerciseIndex exercises={[]} />);
    expect(screen.getByText("no exercises yet")).toBeTruthy();
    expect(container.querySelector('a[href^="/practice/"]')).toBeNull();
  });

  it("renders the no-match state when the query matches nothing", () => {
    render(<ExerciseIndex exercises={exercises} />);
    fireEvent.change(screen.getByLabelText("search exercises"), {
      target: { value: "zzznomatch" },
    });
    expect(screen.getByText("no exercises match that search")).toBeTruthy();
  });

  it("renders the loading skeleton instead of the list", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} loading />);
    expect(container.querySelector('[data-testid="exercise-index-skeleton"]')).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("Alpha Exercise")).toBeNull();
  });

  it("shows the solved indicator only on a solved card, after mount", async () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    // The indicator is set by the post-mount effect.
    await screen.findByText("solved");
    const solvedCard = container.querySelector('a[href="/practice/solved-one"]') as HTMLElement;
    const unsolvedCard = container.querySelector('a[href="/practice/unsolved-two"]') as HTMLElement;
    expect(within(solvedCard).queryByText("solved")).not.toBeNull();
    expect(within(unsolvedCard).queryByText("solved")).toBeNull();
  });
});

// The solved set lives only in this browser's localStorage; the progress row
// is its only carrier off the device and back.
describe("ExerciseIndex progress row", () => {
  function captureDownload(): { blobs: Blob[]; names: string[] } {
    const blobs: Blob[] = [];
    const names: string[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        blobs.push(blob);
        return "blob:mock";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return { blobs, names };
  }

  it("renders the export and import controls below the list", () => {
    render(<ExerciseIndex exercises={exercises} />);
    expect(screen.getByText("progress:")).toBeTruthy();
    expect(screen.getByRole("button", { name: "export solved progress" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "import solved progress" })).toBeTruthy();
  });

  it("downloads the current solved set as one progress file", async () => {
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify(["solved-one", "another"]));
    const captured = captureDownload();
    render(<ExerciseIndex exercises={exercises} />);

    fireEvent.click(screen.getByRole("button", { name: "export solved progress" }));

    expect(captured.names).toEqual(["aarch64-playground-progress.json"]);
    const text = await captured.blobs[0].text();
    expect(JSON.parse(text)).toEqual({
      version: 1,
      solved: ["solved-one", "another"],
      answers: {},
    });
  });

  it("carries the saved answers in the downloaded file", async () => {
    window.localStorage.setItem(
      "aarch64-playground:practice:answer:solved-one",
      JSON.stringify({ version: 1, kind: "write", source: "my work", updatedAt: 7 }),
    );
    const captured = captureDownload();
    render(<ExerciseIndex exercises={exercises} />);

    fireEvent.click(screen.getByRole("button", { name: "export solved progress" }));

    const bundle = JSON.parse(await captured.blobs[0].text()) as {
      answers: Record<string, { source: string }>;
    };
    expect(bundle.answers["solved-one"].source).toBe("my work");
  });

  it("counts the imported answers in the toast", async () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bundle = JSON.stringify({
      version: 1,
      solved: ["solved-one"],
      answers: {
        "solved-one": { version: 1, kind: "write", source: "from the file", updatedAt: 9 },
      },
    });

    fireEvent.change(fileInput, {
      target: { files: [new File([bundle], "progress.json", { type: "application/json" })] },
    });

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("imported 1 solved exercise and 1 saved answer"),
    );
  });

  it("opens the file picker when import is clicked", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(fileInput, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "import solved progress" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("merges an imported file into the stored set and reports the count", async () => {
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify(["solved-one"]));
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bundle = JSON.stringify({ version: 1, solved: ["solved-one", "unsolved-two"] });

    fireEvent.change(fileInput, {
      target: {
        files: [new File([bundle], "progress.json", { type: "application/json" })],
      },
    });

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("imported 1 solved exercise"),
    );
    expect(JSON.parse(window.localStorage.getItem(SOLVED_KEY) as string)).toEqual([
      "solved-one",
      "unsolved-two",
    ]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("says nothing new when the file adds no exercises", async () => {
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify(["solved-one"]));
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [
          new File([JSON.stringify({ version: 1, solved: ["solved-one"] })], "progress.json"),
        ],
      },
    });

    await waitFor(() => expect(toastInfo).toHaveBeenCalledWith("nothing new to import"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("refuses a malformed file with the reason and leaves the set alone", async () => {
    window.localStorage.setItem(SOLVED_KEY, JSON.stringify(["solved-one"]));
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [new File([JSON.stringify({ version: 9, solved: [] })], "progress.json")],
      },
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "that progress file has an unrecognized version",
      ),
    );
    expect(window.localStorage.getItem(SOLVED_KEY)).toBe(JSON.stringify(["solved-one"]));
  });

  it("refuses a file that is not json at all", async () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [new File(["not json"], "progress.json")] },
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("that file is not valid json"));
  });

  it("rejects an over-cap file on size, before reading it", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const oversized = new File(["{}"], "huge.json");
    Object.defineProperty(oversized, "size", {
      value: MAX_BOOKMARK_JSON_BYTES + 1,
      configurable: true,
    });
    const read = vi.spyOn(oversized, "text");

    fireEvent.change(fileInput, { target: { files: [oversized] } });

    expect(toastError).toHaveBeenCalledWith(
      checkUploadSize(MAX_BOOKMARK_JSON_BYTES + 1, MAX_BOOKMARK_JSON_BYTES, "progress file"),
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("ignores a change event with no file picked", () => {
    const { container } = render(<ExerciseIndex exercises={exercises} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
