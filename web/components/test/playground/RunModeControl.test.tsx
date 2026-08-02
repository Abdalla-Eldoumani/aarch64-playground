// The run-mode control's contract: two lowercase segments, the chosen one
// filled cyan and marked pressed, every cell keyboard-reachable at a 44px
// target, and the whole group inert while a terminal session owns the pane.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { RunModeControl } from "@/components/playground/RunModeControl";

afterEach(() => {
  cleanup();
});

describe("RunModeControl", () => {
  it("renders both surfaces as lowercase segments in one group", () => {
    render(<RunModeControl mode="console" onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: "run in" });
    const cells = group.querySelectorAll("button");
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe("console");
    expect(cells[1].textContent).toBe("terminal");
  });

  it("marks the chosen segment pressed and fills it cyan", () => {
    render(<RunModeControl mode="terminal" onChange={vi.fn()} />);
    const terminal = screen.getByLabelText("run in the terminal");
    const console_ = screen.getByLabelText("run in the console");
    expect(terminal.getAttribute("aria-pressed")).toBe("true");
    expect(console_.getAttribute("aria-pressed")).toBe("false");
    // Cyan is the student acting; the unchosen cell stays quiet.
    expect(terminal.className).toContain("bg-[var(--cyan)]");
    expect(console_.className).not.toContain("bg-[var(--cyan)]");
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

  it("matches the header band's control height and keeps a visible focus ring", () => {
    // 36px like the band's other controls: the band must not change height
    // when the control appears and disappears with the loaded program.
    render(<RunModeControl mode="console" onChange={vi.fn()} />);
    for (const label of ["run in the console", "run in the terminal"]) {
      const cell = screen.getByLabelText(label);
      expect(cell.className).toContain("min-h-[36px]");
      expect(cell.className).toContain("px-3.5");
      expect(cell.className).toContain("focus-visible:[box-shadow:var(--ring)]");
    }
  });

  it("goes inert while a session owns the pane, and says why", () => {
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

  it("carries no reason attribute when it is live", () => {
    const { container } = render(<RunModeControl mode="console" onChange={vi.fn()} />);
    expect(container.querySelector("[title]")).toBeNull();
  });
});
