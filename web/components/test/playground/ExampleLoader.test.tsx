import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExampleLoader } from "@/components/playground/ExampleLoader";

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
  "Miscellaneous",
];

/** Open the custom select and return its listbox. */
function openList(): HTMLElement {
  fireEvent.click(screen.getByRole("combobox", { name: "Load example program" }));
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

  it("seeds the two previously-empty stages with the filler programs", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const labels = optionLabels(openList());

    expect(labels).toContain("globals (load + store)");
    expect(labels).toContain("locals (sum + product)");
  });

  it("offers every example with a clean, week-free label", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const labels = optionLabels(openList());
    // 14 kept programs + the two stage fillers + the six playable extras
    // under Miscellaneous.
    expect(labels.length).toBe(22);
    for (const label of labels) {
      expect(label).not.toMatch(/week\d/);
    }
    expect(labels).toContain("arithmetic");
    expect(labels).toContain("copy file");
    expect(labels).toContain("triangle area (single)");
    expect(labels).toContain("snake");
    expect(labels).toContain("data structures visualizer");
    expect(labels).toContain("calc (short for calculator)");
    expect(labels).toContain("temp-convert");
    expect(labels).toContain("two-sum");
    expect(labels).toContain("deadzone");
  });

  it("fetches the picked example and forwards the payload + label to onLoad", async () => {
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
      // The loader replaces the fetch's stem-shaped label with the human
      // name; the stem itself rides along so the launch tables can be
      // consulted after the load.
      label: "arithmetic",
      stem: "basics",
    });
  });

  it("forwards a fixture-bearing example's inputs in the payload", async () => {
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
