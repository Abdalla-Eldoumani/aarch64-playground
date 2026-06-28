import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { REFERENCE_INSTRUCTIONS, type ReferenceInstruction } from "@/lib/reference-data";

// Echo the markdown the component feeds the sanitizing renderer, so the usage
// prose shows up as plain text without pulling react-markdown into this focused
// test. CodeBlock and BitFieldDiagram stay real so the example and the encoding
// render for real.
vi.mock("@/components/LessonMarkdown", () => ({
  LessonMarkdown: (props: { markdown: string }) => (
    <div data-testid="usage">{props.markdown}</div>
  ),
}));

import { InstructionReference } from "./InstructionReference";

const THEMES = ["dark", "light", "high-contrast"] as const;

// Two categories, three entries: one carries an encoding (add), the others do
// not (mov, ldr). Distinct syntax/example strings make the detail unambiguous.
const FIXTURE: ReferenceInstruction[] = [
  {
    mnemonic: "mov",
    category: "Data processing",
    syntax: "mov xd, xn",
    summary: "mov summary prose",
    example: "mov x0, x1",
    gotchas: ["mov gotcha note"],
  },
  {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, xm",
    summary: "add summary prose",
    example: "add x0, x1, x2",
    encoding: [
      { bits: 1, label: "sf" },
      { bits: 31, label: "rest" },
    ],
  },
  {
    mnemonic: "ldr",
    category: "Memory",
    syntax: "ldr xt, [xn]",
    summary: "ldr summary prose",
    example: "ldr x0, [x1]",
    gotchas: ["ldr gotcha note"],
  },
];

beforeEach(() => {
  // jsdom lacks scrollIntoView; the select / keyboard-nav path calls it.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  // Reset the fragment so one test's selection does not seed the next mount.
  window.history.replaceState(null, "", window.location.pathname);
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("InstructionReference", () => {
  it("renders a category-grouped index of every instruction", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const nav = screen.getByRole("navigation", { name: /instruction index/i });
    expect(within(nav).getByText("Data processing")).toBeTruthy();
    expect(within(nav).getByText("Memory")).toBeTruthy();
    expect(screen.getByRole("button", { name: "mov" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "add" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ldr" })).toBeTruthy();
  });

  it("narrows the index as the filter is typed", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    expect(screen.getByRole("button", { name: "mov" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: "ld" } });
    expect(screen.queryByRole("button", { name: "mov" })).toBeNull();
    expect(screen.queryByRole("button", { name: "add" })).toBeNull();
    expect(screen.getByRole("button", { name: "ldr" })).toBeTruthy();
  });

  it("moves the active item with ArrowDown and opens it with Enter", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const nav = screen.getByRole("navigation", { name: /instruction index/i });
    fireEvent.keyDown(nav, { key: "ArrowDown" });
    fireEvent.keyDown(nav, { key: "Enter" });
    const detail = screen.getByLabelText("instruction detail");
    expect(detail.textContent).toContain("add xd, xn, xm");
    expect(
      screen.getByRole("button", { name: "add" }).getAttribute("aria-current"),
    ).toBe("true");
  });

  it("focuses the filter when / is pressed in the index", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i);
    const nav = screen.getByRole("navigation", { name: /instruction index/i });
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(nav, { key: "/" });
    expect(document.activeElement).toBe(input);
  });

  it("clears the filter when Escape is pressed", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ld" } });
    expect(input.value).toBe("ld");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
    expect(screen.getByRole("button", { name: "mov" })).toBeTruthy();
  });

  it("shows the selected instruction's syntax, example, and gotchas", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const detail = screen.getByLabelText("instruction detail");
    expect(detail.textContent).toContain("mov xd, xn"); // syntax
    expect(detail.textContent).toContain("mov x0, x1"); // example via real CodeBlock
    expect(detail.textContent).toContain("mov gotcha note"); // gotchas list
    expect(detail.textContent).toContain("mov summary prose"); // usage via LessonMarkdown
  });

  it("renders the encoding only for an instruction that has one", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    // default selection (mov) has no encoding
    expect(screen.queryByLabelText("mov encoding")).toBeNull();
    // add carries an encoding -> the bit-field diagram renders
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByLabelText("add encoding")).toBeTruthy();
    // a non-encoded entry drops the diagram again
    fireEvent.click(screen.getByRole("button", { name: "ldr" }));
    expect(screen.queryByLabelText("add encoding")).toBeNull();
    expect(screen.queryByLabelText("ldr encoding")).toBeNull();
  });

  it("links the example into the playground with a share hash", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const link = screen.getByRole("link", { name: /try in playground/i });
    expect((link.getAttribute("href") ?? "").startsWith("/playground#p2=")).toBe(true);
  });

  it("marks the selected index item with aria-current", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    expect(
      screen.getByRole("button", { name: "mov" }).getAttribute("aria-current"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "ldr" }));
    expect(
      screen.getByRole("button", { name: "ldr" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "mov" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<InstructionReference instructions={FIXTURE} />);
      expect(
        screen.getByRole("navigation", { name: /instruction index/i }),
      ).toBeTruthy();
      unmount();
    }
  });

  it("renders the real reference data set", () => {
    render(<InstructionReference instructions={REFERENCE_INSTRUCTIONS} />);
    expect(
      screen.getByRole("navigation", { name: /instruction index/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "mov" })).toBeTruthy();
  });
});
