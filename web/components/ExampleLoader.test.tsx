import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExampleLoader } from "./ExampleLoader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The eight fixed level-up stages, in the order the concepts build.
const STAGES = [
  "First programs",
  "Data and memory",
  "Stack and locals",
  "Records and arrays",
  "Subroutines",
  "Static data and command-line arguments",
  "Floating point",
  "Files and I/O",
];

function optgroupsOf(select: HTMLSelectElement): HTMLOptGroupElement[] {
  return Array.from(select.querySelectorAll("optgroup")) as HTMLOptGroupElement[];
}

describe("ExampleLoader", () => {
  it("presents the eight level-up stages in order, each non-empty, no week labels", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    const groups = optgroupsOf(select);

    expect(groups.map((g) => g.label)).toEqual(STAGES);
    for (const group of groups) {
      expect(group.querySelectorAll("option").length).toBeGreaterThan(0);
      expect(group.label).not.toMatch(/week/i);
      expect(group.label).not.toMatch(/cpsc/i);
    }
  });

  it("seeds the two previously-empty stages with the filler programs", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    const groups = optgroupsOf(select);

    const valuesIn = (label: string) => {
      const group = groups.find((g) => g.label === label)!;
      return Array.from(group.querySelectorAll("option")).map(
        (o) => (o as HTMLOptionElement).value,
      );
    };

    expect(valuesIn("Data and memory")).toContain("/examples/cpsc355/globals.s");
    expect(valuesIn("Stack and locals")).toContain("/examples/cpsc355/locals.s");
  });

  it("offers every example with a clean, week-free file path", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option"))
      .map((o) => (o as HTMLOptionElement).value)
      .filter((v) => v !== "");
    // 13 kept programs + the two stage fillers.
    expect(options.length).toBe(15);
    for (const value of options) {
      expect(value).toMatch(/^\/examples\/cpsc355\/[a-z-]+\.s$/);
      expect(value).not.toMatch(/week\d/);
    }
    expect(options).toContain("/examples/cpsc355/basics.s");
    expect(options).toContain("/examples/cpsc355/copy-file.s");
  });

  it("fetches the picked file and forwards body + label to onLoad", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "// basics source\n",
    });
    vi.stubGlobal("fetch", fetchMock);
    const onLoad = vi.fn();
    render(<ExampleLoader onLoad={onLoad} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    fireEvent.change(select, {
      target: { value: "/examples/cpsc355/basics.s" },
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith("/examples/cpsc355/basics.s");
    expect(onLoad).toHaveBeenCalledWith("// basics source\n", "arithmetic");
  });

  it("shows an inline alert when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    // Pick a real option so the change event fires; fetch is mocked to fail.
    await act(async () => {
      fireEvent.change(select, {
        target: { value: "/examples/cpsc355/basics.s" },
      });
      // Allow fetch -> setState -> render to flush.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/404/);
  });
});
