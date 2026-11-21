import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExampleLoader, GROUPS } from "@/components/playground/ExampleLoader";
import { EXAMPLES } from "@/lib/playground/example-catalog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The fixed level-up stages, in the order the concepts build, plus the
// closing miscellaneous stage for playable extras.
const STAGES = [
  "First programs",
  "Data and memory",
  "Stack and locals",
  "Records and arrays",
  "Subroutines",
  "Static data and command-line arguments",
  "Floating point",
  "Files and I/O",
  "Vector registers (not taught in the course)",
  "Miscellaneous",
];

/** Open the custom select and return its listbox. */
function openList(): HTMLElement {
  fireEvent.click(screen.getByRole("combobox", { name: "load an example program" }));
  return screen.getByRole("listbox");
}

function optionLabels(listbox: HTMLElement): string[] {
  return Array.from(listbox.querySelectorAll('[role="option"]')).map(
    (option) => option.textContent ?? "",
  );
}

/** Group headers render in document order ahead of their options. */
function groupHeaders(listbox: HTMLElement): string[] {
  return Array.from(listbox.querySelectorAll(".tracking-\\[0\\.14em\\]")).map(
    (header) => header.textContent ?? "",
  );
}

async function pick(label: string) {
  const listbox = openList();
  const option = Array.from(
    listbox.querySelectorAll('[role="option"]'),
  ).find((candidate) => candidate.textContent === label)!;
  await act(async () => {
    fireEvent.pointerDown(option);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ExampleLoader", () => {
  it("presents the level-up stages in order, each non-empty, no week labels", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const listbox = openList();
    const headers = groupHeaders(listbox);

    expect(headers).toEqual(STAGES);
    for (const header of headers) {
      expect(header).not.toMatch(/week/i);
      expect(header).not.toMatch(/cpsc/i);
    }
    // Every stage carries at least one program.
    expect(optionLabels(listbox).length).toBeGreaterThanOrEqual(headers.length);
  });

  it("lists the filler programs for the two stages that have nothing else", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const labels = optionLabels(openList());

    expect(labels).toContain("globals (load + store)");
    expect(labels).toContain("locals (sum + product)");
  });

  it("offers every example with a clean, week-free label", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const labels = optionLabels(openList());
    // 14 course programs, 2 stage fillers, the program the playground opens
    // with, the 6 vector demonstrations, and the 7 playable extras under
    // Miscellaneous.
    expect(labels.length).toBe(30);
    for (const label of labels) {
      expect(label).not.toMatch(/week\d/);
    }
    expect(labels).toContain("arithmetic");
    expect(labels).toContain("distance from zero");
    expect(labels).toContain("copy file");
    expect(labels).toContain("triangle area (single precision)");
    expect(labels).toContain("snake");
    expect(labels).toContain("data structures visualizer");
    expect(labels).toContain("calculator");
    expect(labels).toContain("temperature converter");
    expect(labels).toContain("two sum");
    expect(labels).toContain("deadzone");
    expect(labels).toContain("flappy");
    expect(labels).toContain("uppercase a line");
    expect(labels).toContain("mean of floats");
  });

  it("fetches the picked example and passes its source and label to onLoad", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "// basics source\n",
    });
    vi.stubGlobal("fetch", fetchMock);
    const onLoad = vi.fn();
    render(<ExampleLoader onLoad={onLoad} />);
    await pick("arithmetic");
    expect(fetchMock).toHaveBeenCalledWith("/examples/cpsc355/basics.s");
    expect(onLoad).toHaveBeenCalledWith({
      source: "// basics source\n",
      // The loader swaps the file-name label for the readable name; the file
      // name (stem) comes along so the launch tables can be checked after
      // the load.
      label: "arithmetic",
      stem: "basics",
    });
  });

  it("passes along the input files an example comes with", async () => {
    const routes: Record<string, string> = {
      "/examples/cpsc355/read-file.s": "// read file\n",
      "/examples/cpsc355/fixtures/read-file.vfs.json": '{"input.txt": "Hi\\n"}',
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: url in routes,
        status: url in routes ? 200 : 404,
        statusText: "",
        text: async () => routes[url] ?? "",
      })),
    );
    const onLoad = vi.fn();
    render(<ExampleLoader onLoad={onLoad} />);
    await pick("read file");
    expect(onLoad).toHaveBeenCalledWith({
      source: "// read file\n",
      label: "read file",
      stem: "read-file",
      vfs: { "input.txt": "Hi\n" },
    });
  });

  it("lists every example under its stage in order, and loads each under its own label", async () => {
    // [stage, [label, stem] in menu order]
    const MENU: [string, [string, string][]][] = [
      ["First programs", [["arithmetic", "basics"], ["distance from zero", "distance"]]],
      ["Data and memory", [["globals (load + store)", "globals"]]],
      ["Stack and locals", [["locals (sum + product)", "locals"]]],
      [
        "Records and arrays",
        [["scores (scanf + avg)", "array-scores"], ["student record", "student-record"]],
      ],
      ["Subroutines", [["find max", "find-max"], ["is prime", "is-prime"]]],
      [
        "Static data and command-line arguments",
        [["static counter", "static-counter"], ["command-line args", "command-line-args"]],
      ],
      [
        "Floating point",
        [["circle area", "circle-area"], ["triangle area (single precision)", "triangle-area"]],
      ],
      [
        "Files and I/O",
        [
          ["hello (write)", "hello"],
          ["echo (read)", "echo"],
          ["write file", "write-file"],
          ["read file", "read-file"],
          ["copy file", "copy-file"],
        ],
      ],
      [
        "Vector registers (not taught in the course)",
        [
          ["uppercase a line", "vector-upper"],
          ["count the characters", "vector-strlen"],
          ["sum sixteen ints", "vector-sum"],
          ["dot product", "vector-dot"],
          ["brighten a picture", "vector-brighten"],
          ["mean of floats", "vector-mean"],
        ],
      ],
      [
        "Miscellaneous",
        [
          ["snake", "snake"],
          ["data structures visualizer", "dsav"],
          ["calculator", "calc"],
          ["temperature converter", "temp-convert"],
          ["two sum", "two-sum"],
          ["deadzone", "deadzone"],
          ["flappy", "flappy"],
        ],
      ],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => (url.endsWith(".vfs.json") ? "{}" : "x\n"),
      })),
    );
    const onLoad = vi.fn();
    render(<ExampleLoader onLoad={onLoad} />);

    for (const [, rows] of MENU) {
      for (const [label, stem] of rows) {
        await pick(label);
        await waitFor(() =>
          expect(onLoad).toHaveBeenLastCalledWith(expect.objectContaining({ label, stem })),
        );
      }
    }

    const shown = Array.from(openList().children).map((group) => [
      groupHeaders(group as HTMLElement)[0],
      optionLabels(group as HTMLElement),
    ]);
    expect(shown).toEqual(MENU.map(([stage, rows]) => [stage, rows.map(([label]) => label)]));
  });

  it("lists exactly the catalog's examples, in the catalog's order", () => {
    const catalog = EXAMPLES.map((example) => example.stem);
    const menu = GROUPS.flatMap((group) => group.items.map((item) => item.stem));
    for (const stem of catalog) {
      expect(menu, `${stem} is in the catalog but not the menu`).toContain(stem);
    }
    for (const stem of menu) {
      expect(catalog, `${stem} is in the menu but not the catalog`).toContain(stem);
    }
    expect(menu, "the menu lists the catalog's examples in another order").toEqual(catalog);
  });

  it("shows an inline alert when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "",
      }),
    );
    render(<ExampleLoader onLoad={() => {}} />);
    // Pick a real option so the load fires; fetch is mocked to fail.
    await pick("arithmetic");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/404/);
  });
});
