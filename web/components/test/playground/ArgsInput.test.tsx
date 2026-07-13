import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ArgsInput } from "@/components/playground/ArgsInput";
import { hashString } from "@/lib/playground/auto-save";
import { MAX_ARGS_CHARS } from "@/lib/playground/upload-guard";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

beforeEach(() => {
  window.localStorage.clear();
});

function Harness({ source, initial = "" }: { source: string; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <ArgsInput source={source} value={value} onChange={setValue} />;
}

describe("ArgsInput", () => {
  it("calls onChange when the user types", () => {
    render(<Harness source="// prog" />);
    const input = screen.getByLabelText("command-line arguments") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello world" } });
    expect(input.value).toBe("hello world");
  });

  it("accepts an args value exactly at the cap", () => {
    render(<Harness source="// prog" />);
    const input = screen.getByLabelText("command-line arguments") as HTMLInputElement;
    const atCap = "x".repeat(MAX_ARGS_CHARS);
    fireEvent.change(input, { target: { value: atCap } });
    expect(input.value).toBe(atCap);
  });

  it("rejects an over-cap args value and keeps the previous value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Harness source="// prog" initial="ok" />);
    const input = screen.getByLabelText("command-line arguments") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x".repeat(MAX_ARGS_CHARS + 1) } });
    // The over-cap input is not propagated, so the controlled value reverts.
    expect(input.value).toBe("ok");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("persists per-program in localStorage after a debounce", () => {
    vi.useFakeTimers();
    render(<Harness source="// prog A" />);
    const input = screen.getByLabelText("command-line arguments") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const saved = Object.entries(window.localStorage)
      .find(([k]) => k.startsWith("aarch64-playground:args:"));
    expect(saved?.[1]).toBe("abc");
  });

  it("restores saved args when a different source mounts", () => {
    // Pre-populate the storage entry for source X
    window.localStorage.setItem(
      `aarch64-playground:args:${hashString("// prog X")}`,
      "saved value",
    );
    render(<Harness source="// prog X" />);
    const input = screen.getByLabelText("command-line arguments") as HTMLInputElement;
    expect(input.value).toBe("saved value");
  });

  it("clears the saved entry when the user empties the input", () => {
    vi.useFakeTimers();
    render(<Harness source="// prog Y" initial="something" />);
    const input = screen.getByLabelText("command-line arguments") as HTMLInputElement;
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(input, { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const found = Object.entries(window.localStorage)
      .find(([k]) => k.startsWith("aarch64-playground:args:"));
    expect(found).toBeUndefined();
  });
});
