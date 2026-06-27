import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExampleLoader } from "./ExampleLoader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExampleLoader", () => {
  it("groups the cpsc 355 examples and drops the pruned groups", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    const groupLabels = Array.from(select.querySelectorAll("optgroup")).map(
      (g) => (g as HTMLOptGroupElement).label,
    );
    expect(groupLabels).toContain("cpsc 355 — basics");
    expect(groupLabels).toContain("cpsc 355 — I/O and syscalls");
    // The starter and bare-metal groups were pruned from the corpus.
    expect(groupLabels).not.toContain("starters (A1–A6)");
    expect(groupLabels).not.toContain("bare-metal classics");
  });

  it("offers every renamed example with a clean, week-free label", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option"))
      .map((o) => (o as HTMLOptionElement).value)
      .filter((v) => v !== "");
    expect(options.length).toBe(13);
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
