import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ArgsInput } from "./ArgsInput";
import { hashString } from "@/lib/auto-save";

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
