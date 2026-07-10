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

// Stub the shared embeddable with a light marker that echoes the props the
// reference feeds it, so the run-in-place tests never instantiate Monaco or
// the WASM worker.
vi.mock("@/components/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: { chrome?: string; startSource?: string }) => (
    <div
      data-testid="embed"
      data-chrome={props.chrome}
      data-startsource={props.startSource}
    />
  ),
}));

import { InstructionReference } from "./InstructionReference";
import { playgroundSource } from "@/lib/playground-source";

const THEMES = ["dark", "light", "high-contrast"] as const;

// Two categories, four entries: one carries a worked encoding (add), one sets
// flags (cmp), the others are plain. Distinct syntax/example strings make the
// detail unambiguous.
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
    cExample: "x0 = x1 + x2;",
    encoding: [
      { bits: 1, label: "sf", value: "1", meaning: "x width" },
      { bits: 31, label: "rest", value: "0".repeat(31) },
    ],
    encodedAsm: "add x19, x0, 8",
  },
  {
    mnemonic: "cmp",
    category: "Compare and test",
    syntax: "cmp xn, xm",
    summary: "cmp summary prose",
    example: "cmp x0, x1",
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

  it("runs the example in place with the same payload the deep link carries", async () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(
      screen.getByRole("button", { name: "run this example: mov" }),
    );
    const embed = await screen.findByTestId("embed");
    expect(embed.getAttribute("data-chrome")).toBe("embed");
    expect(embed.getAttribute("data-startsource")).toBe(
      playgroundSource(FIXTURE[0]),
    );
    // The live bench replaces the static example block until closed.
    fireEvent.click(
      screen.getByRole("button", { name: "close the live example for mov" }),
    );
    expect(screen.queryByTestId("embed")).toBeNull();
    const detail = screen.getByLabelText("instruction detail");
    expect(detail.textContent).toContain("mov x0, x1");
  });

  it("selecting another instruction retires the live example", async () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(
      screen.getByRole("button", { name: "run this example: mov" }),
    );
    await screen.findByTestId("embed");
    fireEvent.click(screen.getByRole("button", { name: "ldr" }));
    expect(screen.queryByTestId("embed")).toBeNull();
    expect(
      screen.getByRole("button", { name: "run this example: ldr" }),
    ).toBeTruthy();
  });

  it("renders the flag panel only for flag-setting entries", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    // mov is selected by default and sets no flags
    expect(screen.queryByLabelText("cmp flag effect")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "cmp" }));
    expect(screen.getByLabelText("cmp flag effect")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ldr" }));
    expect(screen.queryByLabelText("cmp flag effect")).toBeNull();
  });

  it("captions the worked encoding with its concrete instruction", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByText("add x19, x0, 8")).toBeTruthy();
    expect(screen.getByLabelText("assembled word")).toBeTruthy();
  });

  it("shows the C-equivalent chip only when the data carries one", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    // mov (default selection) has no cExample -> no section
    expect(screen.queryByText("c equivalent")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByText("c equivalent")).toBeTruthy();
    expect(screen.getByText("x0 = x1 + x2;")).toBeTruthy();
  });

  it("dims the flags row for non-setters and notes nzcv for setters", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    // mov sets no flags: the four chips render dimmed with the quiet note
    const movFlags = screen.getByRole("group", { name: "mov flags" });
    for (const flag of ["N", "Z", "C", "V"]) {
      expect(within(movFlags).getByText(flag).className).toContain(
        "text-[var(--text-tertiary)]",
      );
    }
    expect(within(movFlags).getByText("does not set flags")).toBeTruthy();
    // cmp sets nzcv: the chips take ink and the note flips
    fireEvent.click(screen.getByRole("button", { name: "cmp" }));
    const cmpFlags = screen.getByRole("group", { name: "cmp flags" });
    expect(within(cmpFlags).getByText("N").className).toContain(
      "text-[var(--text-secondary)]",
    );
    expect(within(cmpFlags).getByText("sets nzcv")).toBeTruthy();
  });

  it("labels the encoding section and renders the diagram with bit headers", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByText("encoding")).toBeTruthy();
    // The reference size shows the per-field bit ranges (sf is bit 31 alone).
    const diagram = screen.getByLabelText("add encoding");
    expect(within(diagram as HTMLElement).getByText("31")).toBeTruthy();
    expect(within(diagram as HTMLElement).getByText("30 : 0")).toBeTruthy();
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

  it("re-selects on hashchange after a pick (back/forward, manual hash edits)", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    // a click pins the selection via picked (replaceState fires no hashchange)
    fireEvent.click(screen.getByRole("button", { name: "ldr" }));
    expect(
      screen.getByRole("button", { name: "ldr" }).getAttribute("aria-current"),
    ).toBe("true");
    // a later hash change must win over the pick and re-select the match
    window.history.replaceState(null, "", "#add");
    fireEvent(window, new Event("hashchange"));
    expect(
      screen.getByRole("button", { name: "add" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "ldr" }).getAttribute("aria-current"),
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
