// The run-mode control's contract: two lowercase segments, the chosen one
// marked pressed, every cell a focusable button, and the whole group disabled
// while a terminal session is running.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { RunModeControl } from "@/components/playground/RunModeControl";

afterEach(() => {
  cleanup();
});

describe("RunModeControl", () => {
  it("renders console and terminal as lowercase segments in one group", () => {
    render(<RunModeControl mode="console" onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: "run in" });
    const cells = group.querySelectorAll("button");
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe("console");
    expect(cells[1].textContent).toBe("terminal");
  });

  it("marks the chosen segment pressed and the other not", () => {
    render(<RunModeControl mode="terminal" onChange={vi.fn()} />);
    const terminal = screen.getByLabelText("run in the terminal");
    const console_ = screen.getByLabelText("run in the console");
    expect(terminal.getAttribute("aria-pressed")).toBe("true");
    expect(console_.getAttribute("aria-pressed")).toBe("false");
  });

  it("reports the segment the student picked", () => {
    const onChange = vi.fn();
    render(<RunModeControl mode="console" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("run in the terminal"));
    expect(onChange).toHaveBeenCalledWith("terminal");
  });

  it("is operable from the keyboard: each cell is a focusable button", () => {
    const onChange = vi.fn();
    render(<RunModeControl mode="console" onChange={onChange} />);
    const terminal = screen.getByLabelText("run in the terminal") as HTMLButtonElement;
    terminal.focus();
    expect(document.activeElement).toBe(terminal);
    // A native button commits on Enter and Space; jsdom does not synthesize
    // the click, so the activation contract is pinned through the element
    // type plus the click handler above.
    expect(terminal.tagName).toBe("BUTTON");
    expect(terminal.getAttribute("type")).toBe("button");
  });

  it("is disabled while a terminal session runs, and says why", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RunModeControl mode="terminal" onChange={onChange} disabled />,
    );
    const cell = screen.getByLabelText("run in the console") as HTMLButtonElement;
    expect(cell.disabled).toBe(true);
    fireEvent.click(cell);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[title="a terminal session is running"]')).not.toBeNull();
  });

  it("shows no disabled reason when it is enabled", () => {
    const { container } = render(<RunModeControl mode="console" onChange={vi.fn()} />);
    expect(container.querySelector("[title]")).toBeNull();
  });
});
