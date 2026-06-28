import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FirstRunState } from "./FirstRunState";

afterEach(() => cleanup());

describe("FirstRunState", () => {
  it("renders distinct first-run copy: what this is and what to press", () => {
    render(<FirstRunState />);
    const region = screen.getByLabelText("no program assembled");
    const text = region.textContent ?? "";
    expect(text.toLowerCase()).toContain("aarch64");
    expect(text).toContain("Assemble");
  });

  it("offers Assemble as the first move when wired", () => {
    const onAssemble = vi.fn();
    render(<FirstRunState onAssemble={onAssemble} />);
    fireEvent.click(screen.getByRole("button", { name: "assemble" }));
    expect(onAssemble).toHaveBeenCalledTimes(1);
  });

  it("omits the Assemble button when no handler is given", () => {
    render(<FirstRunState />);
    expect(screen.queryByRole("button", { name: "assemble" })).toBeNull();
  });
});
