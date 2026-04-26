import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExampleLoader } from "./ExampleLoader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExampleLoader", () => {
  it("groups every cpsc 355 example, the A1-A6 starters, and the bare-metal classics", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    const groupLabels = Array.from(select.querySelectorAll("optgroup")).map(
      (g) => (g as HTMLOptGroupElement).label,
    );
    expect(groupLabels).toContain("cpsc 355 — basics");
    expect(groupLabels).toContain("cpsc 355 — I/O and syscalls");
    expect(groupLabels).toContain("starters (A1–A6)");
    expect(groupLabels).toContain("bare-metal classics");
  });

  it("offers all six A1-A6 starters in the starters group", () => {
    render(<ExampleLoader onLoad={() => {}} />);
    const select = screen.getByLabelText("Load example program");
    const startersGroup = Array.from(select.querySelectorAll("optgroup")).find(
      (g) => (g as HTMLOptGroupElement).label === "starters (A1–A6)",
    ) as HTMLOptGroupElement | undefined;
    expect(startersGroup).toBeDefined();
    const names = Array.from(startersGroup!.querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    expect(names).toEqual([
      "A1 min cubic",
      "A2 multiply via shift-add",
      "A3 sort array",
      "A4 struct + subroutines",
      "A5 global RPN calculator",
      "A6 file I/O + fp",
    ]);
  });

  it("fetches the picked file and forwards body + label to onLoad", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "// week 3 source\n",
    });
    vi.stubGlobal("fetch", fetchMock);
    const onLoad = vi.fn();
    render(<ExampleLoader onLoad={onLoad} />);
    const select = screen.getByLabelText("Load example program") as HTMLSelectElement;
    fireEvent.change(select, {
      target: { value: "/examples/cpsc355/week03_exercise.s" },
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith("/examples/cpsc355/week03_exercise.s");
    expect(onLoad).toHaveBeenCalledWith("// week 3 source\n", "week 3 exercise");
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
        target: { value: "/examples/cpsc355/week03_exercise.s" },
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
