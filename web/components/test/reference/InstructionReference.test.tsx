import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { REFERENCE_INSTRUCTIONS, type ReferenceInstruction } from "@/lib/content/reference-data";

// Echo the markdown the component feeds the sanitizing renderer, so the usage
// prose shows up as plain text without pulling react-markdown into this focused
// test. CodeBlock and BitFieldDiagram stay real so the example and the encoding
// render for real.
vi.mock("@/components/learn/LessonMarkdown", () => ({
  LessonMarkdown: (props: { markdown: string }) => (
    <div data-testid="usage">{props.markdown}</div>
  ),
}));

// Stub the shared embeddable with a light marker that echoes the props the
// reference feeds it, so the run-in-place tests never instantiate Monaco or
// the WASM worker.
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: {
    chrome?: string;
    startSource?: string;
    registerView?: string;
    registerHeadingLevel?: number;
  }) => (
    <div
      data-testid="embed"
      data-chrome={props.chrome}
      data-startsource={props.startSource}
      data-registerview={props.registerView}
      data-headinglevel={props.registerHeadingLevel}
    />
  ),
}));

import { InstructionReference } from "@/components/reference/InstructionReference";
import { playgroundSource } from "@/lib/playground/playground-source";

// Five categories, seven entries: one carries a worked encoding and an
// intrinsic (add), two set flags (cmp, which has the flag panel, and adcs,
// which does not), one writes a vector register (addv), the others are plain.
// Distinct syntax/example strings make the detail unambiguous.
const FIXTURE: ReferenceInstruction[] = [
  {
    mnemonic: "mov",
    category: "Data processing",
    syntax: "mov xd, xn",
    summary: "mov summary prose",
    example: "mov x0, x1",
    cExample: "Rd = Rm;",
    setsFlags: false,
    registerView: "x",
    gotchas: ["mov gotcha note"],
  },
  {
    mnemonic: "add",
    category: "Data processing",
    syntax: "add xd, xn, xm",
    summary: "add summary prose",
    example: "add x0, x1, x2",
    cExample: "x0 = x1 + x2;",
    intrinsic: "vaddq_u8",
    setsFlags: false,
    registerView: "x",
    encoding: [
      { bits: 1, label: "sf", value: "1", meaning: "x width" },
      { bits: 31, label: "rest", value: "0".repeat(31) },
    ],
    encodedAsm: "add x19, x0, 8",
  },
  {
    mnemonic: "adcs",
    category: "Data processing",
    syntax: "adcs xd, xn, xm",
    summary: "adcs summary prose",
    example: "adcs x0, x1, x2",
    cExample: "Rd = Rn + Rm + C;",
    setsFlags: true,
    registerView: "x",
  },
  {
    mnemonic: "cmp",
    category: "Compare and test",
    syntax: "cmp xn, xm",
    summary: "cmp summary prose",
    example: "cmp x0, x1",
    cExample: "uint64_t r = Rn - op2;",
    setsFlags: true,
    registerView: "x",
  },
  {
    mnemonic: "ldr",
    category: "Memory",
    syntax: "ldr xt, [xn]",
    summary: "ldr summary prose",
    example: "ldr x0, [x1]",
    cExample: "Xt = *(uint64_t *)Xn;",
    setsFlags: false,
    registerView: "x",
    gotchas: ["ldr gotcha note"],
  },
  {
    mnemonic: "b.cond",
    category: "Branches",
    syntax: "b.eq label / b.ne label / ...",
    summary: "b.cond summary prose",
    example: "cmp w0, #0\nb.eq done",
    cExample: "if (cond) goto label;",
    setsFlags: false,
    registerView: "x",
  },
  {
    mnemonic: "addv",
    category: "Vector",
    syntax: "addv bd, vn.8b",
    summary: "addv summary prose",
    example: "addv b3, v7.8b",
    cExample: "Bd = 0;\nfor (int i = 0; i < 8; i++) Bd += Vn[i];",
    setsFlags: false,
    registerView: "v",
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

  it("focuses the filter when / is pressed anywhere else on the page", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i);
    const detail = screen.getByLabelText("instruction detail");
    fireEvent.keyDown(detail, { key: "/" });
    expect(document.activeElement).toBe(input);
  });

  it("leaves / alone while an editable target has the keyboard", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i) as HTMLInputElement;
    const typing = document.createElement("textarea");
    document.body.appendChild(typing);
    typing.focus();
    fireEvent.keyDown(typing, { key: "/" });
    expect(document.activeElement).toBe(typing);
    expect(document.activeElement).not.toBe(input);
    typing.remove();
  });

  it("advertises the / shortcut on the filter itself, not in the placeholder", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i) as HTMLInputElement;
    expect(input.placeholder).toBe("filter mnemonics");
    expect(input.getAttribute("aria-keyshortcuts")).toBe("/");
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

  it("opens the first match when Enter is pressed in the filter", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i);
    // "d" leaves add, adcs, ldr and addv, in that order.
    fireEvent.change(input, { target: { value: "d" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("instruction detail").textContent).toContain("add xd, xn, xm");
    expect(screen.getByRole("button", { name: "add" }).getAttribute("aria-current")).toBe("true");
    expect(window.location.hash).toBe("#add");
  });

  it("opens the mnemonic typed in full before an earlier row that contains it", () => {
    render(<InstructionReference instructions={REFERENCE_INSTRUCTIONS} />);
    const input = screen.getByLabelText(/filter/i);
    // sub and many others come before b in the index and contain the letter.
    fireEvent.change(input, { target: { value: "b" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const detail = screen.getByLabelText("instruction detail");
    expect(detail.querySelector("h2")?.textContent).toBe("b");
  });

  it("leaves the selection alone on Enter when nothing matches", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i);
    fireEvent.change(input, { target: { value: "zzz" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("instruction detail").textContent).toContain("mov xd, xn");
    expect(window.location.hash).toBe("");
  });

  it("keeps the phone keyboard from correcting or capitalising a typed mnemonic", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    const input = screen.getByLabelText(/filter/i);
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("off");
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

  it("runs the example in place with the same program the playground link opens", async () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(
      screen.getByRole("button", { name: "run this example: mov" }),
    );
    const embed = await screen.findByTestId("embed");
    expect(embed.getAttribute("data-chrome")).toBe("embed");
    expect(embed.getAttribute("data-startsource")).toBe(
      playgroundSource(FIXTURE[0]),
    );
    // The running example replaces the static code block until it is closed.
    fireEvent.click(
      screen.getByRole("button", { name: "close the live example for mov" }),
    );
    expect(screen.queryByTestId("embed")).toBeNull();
    const detail = screen.getByLabelText("instruction detail");
    expect(detail.textContent).toContain("mov x0, x1");
  });

  it("selecting another instruction closes the live example", async () => {
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

  it("links the flag panel over to the b.cond entry", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "cmp" }));
    const link = screen.getByRole("link", { name: /see b\.cond/ });
    expect(link.getAttribute("href")).toBe("#b-cond");
    // the anchor's target exists: the index item carries the fragment id.
    expect(screen.getByRole("button", { name: "b.cond" }).id).toBe("b-cond");
  });

  it("mounts the condition-code explorer only on b.cond", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    expect(screen.queryByLabelText("b.cond condition codes")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "b.cond" }));
    expect(screen.getByLabelText("b.cond condition codes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ldr" }));
    expect(screen.queryByLabelText("b.cond condition codes")).toBeNull();
  });

  it("captions the worked encoding with its concrete instruction", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByText("add x19, x0, 8")).toBeTruthy();
    expect(screen.getByLabelText("assembled word")).toBeTruthy();
  });

  it("shows the C equivalent for every entry, and the intrinsic when there is one", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    // mov (default selection): its C, and no intrinsic line
    expect(screen.getByText("c equivalent")).toBeTruthy();
    expect(screen.getByText("Rd = Rm;")).toBeTruthy();
    expect(screen.queryByText(/is a function the compiler turns/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "add" }));
    expect(screen.getByText("x0 = x1 + x2;")).toBeTruthy();
    expect(screen.getByText("vaddq_u8")).toBeTruthy();
    expect(screen.getByText(/arm_neon\.h/)).toBeTruthy();
  });

  it("keeps a multi-line C equivalent on its own lines", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "addv" }));
    expect(screen.getByText("Bd = 0;")).toBeTruthy();
    expect(
      screen.getByText("for (int i = 0; i < 8; i++) Bd += Vn[i];"),
    ).toBeTruthy();
  });

  it("opens the live example on the register file the example writes", async () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "addv" }));
    fireEvent.click(
      screen.getByRole("button", { name: "run this example: addv" }),
    );
    const embed = await screen.findByTestId("embed");
    expect(embed.getAttribute("data-registerview")).toBe("v");
    // The entry is an h2, so the panel label inside it is an h3.
    expect(embed.getAttribute("data-headinglevel")).toBe("3");
  });

  it("badges every flag setter, not only the ones with a flag panel", () => {
    render(<InstructionReference instructions={FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "adcs" }));
    const flags = screen.getByRole("group", { name: "adcs flags" });
    expect(within(flags).getByText("sets nzcv")).toBeTruthy();
    expect(screen.queryByLabelText("adcs flag effect")).toBeNull();
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
    // cmp sets nzcv: the chips brighten and the note changes
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

  it("brings a stacked detail back on screen after one of its own fragment links", () => {
    // Below lg the browser's jump to #b-cond lands on the index row carrying
    // that id, thousands of pixels above the detail.
    const media = window.matchMedia;
    const frame = window.requestAnimationFrame;
    const scroll = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    const followLink = (stacked: boolean) => {
      window.matchMedia = ((query: string) => ({
        ...media(query),
        matches: stacked && query.includes("max-width: 1023.98px"),
      })) as typeof window.matchMedia;
      fireEvent.click(screen.getByRole("button", { name: "cmp" }));
      scroll.mockClear();
      fireEvent.click(screen.getByRole("link", { name: /see b\.cond/ }));
      return scroll.mock.contexts;
    };
    window.requestAnimationFrame = (step: FrameRequestCallback) => {
      step(0);
      return 0;
    };
    try {
      render(<InstructionReference instructions={FIXTURE} />);
      const detail = screen.getByRole("region", { name: "instruction detail" });
      expect(followLink(true)).toContain(detail);
      // Beside the index the detail never left the screen.
      expect(followLink(false)).not.toContain(detail);
    } finally {
      window.matchMedia = media;
      window.requestAnimationFrame = frame;
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
