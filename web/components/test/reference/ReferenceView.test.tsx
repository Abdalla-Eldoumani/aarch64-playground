import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The three section renderers are replaced with text markers so this test
// exercises only the shell's wiring (which tab is active -> which section fills
// the panel, and which fragment opens which tab) without pulling in the
// markdown, diagram, or share stacks. The Instructions marker echoes the
// instruction count it receives, so the assertion proves the prop flowed through.
vi.mock("@/components/reference/InstructionReference", () => ({
  InstructionReference: ({ instructions }: { instructions: unknown[] }) =>
    `instruction-reference:${instructions.length}`,
}));
vi.mock("@/components/reference/CallingConventionGuide", () => ({
  CallingConventionGuide: () => "calling-convention-guide",
}));
// The catalog marker echoes the lesson titles it receives.
vi.mock("@/components/reference/PitfallsCatalog", () => ({
  PitfallsCatalog: ({ lessonTitles }: { lessonTitles: Record<string, string> }) =>
    `pitfalls-catalog:${Object.keys(lessonTitles).join(",")}`,
}));
vi.mock("@/components/reference/DirectivesAndDebugger", () => ({
  DirectivesAndDebugger: () => "directives-and-debugger-guide",
}));
// The converter marker echoes the view it was opened at, so the fragment
// wiring is visible without the real widget.
vi.mock("@/components/panels/BaseConverter", () => ({
  BaseConverter: ({ view }: { view?: string }) => `base-converter-widget:${view ?? "none"}`,
}));

import type { ReferenceInstruction } from "@/lib/content/reference-data";
import { ReferenceView } from "@/components/reference/ReferenceView";

const INSTRUCTIONS: ReferenceInstruction[] = [
  {
    mnemonic: "mov",
    category: "Data processing",
    syntax: "mov xd, xn",
    summary: "move a value",
    example: "mov x0, x1",
    cExample: "Rd = Rm;",
    setsFlags: false,
    registerView: "x",
  },
  {
    mnemonic: "b.cond",
    category: "Branches",
    syntax: "b.cond label",
    summary: "branch when the condition holds",
    example: "b.eq done",
    cExample: "if (cond) goto label;",
    setsFlags: false,
    registerView: "x",
  },
];
const LESSON_TITLES = { subroutines: "Writing your own subroutines" };
const CATALOG = "pitfalls-catalog:subroutines";
const GUIDE = "calling-convention-guide";

function renderView() {
  return render(<ReferenceView instructions={INSTRUCTIONS} lessonTitles={LESSON_TITLES} />);
}

function activeTab(): string | null {
  return screen
    .getAllByRole("tab")
    .find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent ?? null;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

// Moves the fragment the way a clicked link or back/forward does; jsdom
// queues its own hashchange, so the event is sent here to keep it in step.
function followFragment(fragment: string): void {
  act(() => {
    window.history.replaceState(null, "", fragment);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

describe("ReferenceView", () => {
  it("renders the five reference tabs with Instructions active by default", () => {
    renderView();
    expect(
      screen.getByRole("tablist", { name: "reference sections" }),
    ).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Instructions",
      "Calling convention",
      "Pitfalls",
      "Converter",
      "Directives and debugger",
    ]);
    expect(activeTab()).toBe("Instructions");
    expect(
      screen.getByText(`instruction-reference:${INSTRUCTIONS.length}`),
    ).toBeTruthy();
  });

  it("swaps the panel section when another tab is clicked", async () => {
    renderView();

    fireEvent.click(screen.getByRole("tab", { name: "Calling convention" }));
    // The guide arrives asynchronously behind next/dynamic too.
    expect(await screen.findByText(GUIDE)).toBeTruthy();
    expect(
      screen.queryByText(`instruction-reference:${INSTRUCTIONS.length}`),
    ).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));
    // The catalog arrives asynchronously behind next/dynamic, with the
    // lesson titles it links to.
    expect(await screen.findByText(CATALOG)).toBeTruthy();
    expect(screen.queryByText(GUIDE)).toBeNull();
  });

  it("mounts the base converter behind its tab", async () => {
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: "Converter" }));
    // The widget arrives asynchronously behind next/dynamic.
    expect(await screen.findByText("base-converter-widget:none")).toBeTruthy();
    expect(screen.getByText(/One bit pattern, five readings/)).toBeTruthy();
    expect(
      screen.queryByText(`instruction-reference:${INSTRUCTIONS.length}`),
    ).toBeNull();
  });

  it("opens the converter at the part a fragment names", async () => {
    for (const [fragment, view] of [
      ["#converter", "none"],
      ["#converter-octal", "octal"],
      ["#converter-ieee754", "ieee754"],
    ] as const) {
      window.history.replaceState(null, "", fragment);
      const { unmount } = renderView();
      expect(activeTab()).toBe("Converter");
      expect(await screen.findByText(`base-converter-widget:${view}`)).toBeTruthy();
      unmount();
    }
  });

  it("opens the pitfalls for #pitfalls and for a link to one card", async () => {
    for (const fragment of ["#pitfalls", "#pitfall-there-is-no-x31"]) {
      window.history.replaceState(null, "", fragment);
      const { unmount } = renderView();
      expect(activeTab()).toBe("Pitfalls");
      expect(await screen.findByText(CATALOG)).toBeTruthy();
      unmount();
    }
  });

  it("opens the calling convention for #calling-convention and for one of its sections", async () => {
    for (const fragment of ["#calling-convention", "#calling-convention-frame-chain"]) {
      window.history.replaceState(null, "", fragment);
      const { unmount } = renderView();
      expect(activeTab()).toBe("Calling convention");
      expect(await screen.findByText(GUIDE)).toBeTruthy();
      unmount();
    }
  });

  it("keeps the calling convention open while its contents links are followed", async () => {
    window.history.replaceState(null, "", "#calling-convention");
    renderView();
    expect(await screen.findByText(GUIDE)).toBeTruthy();
    // A link in the guide's own contents, then one that names nothing here.
    followFragment("#calling-convention-rules");
    expect(activeTab()).toBe("Calling convention");
    followFragment("#calling-convention-nonsense");
    expect(activeTab()).toBe("Calling convention");
    expect(screen.getByText(GUIDE)).toBeTruthy();
  });

  it("a link followed later wins over a tab pick when it names a tab or an instruction", async () => {
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));
    expect(await screen.findByText(CATALOG)).toBeTruthy();

    // A pitfall card's reference link: the instruction list opens on it.
    followFragment("#b-cond");
    expect(activeTab()).toBe("Instructions");

    followFragment("#converter-ieee754");
    expect(await screen.findByText("base-converter-widget:ieee754")).toBeTruthy();

    followFragment("#calling-convention");
    expect(await screen.findByText(GUIDE)).toBeTruthy();

    followFragment("#pitfall-there-is-no-x31");
    expect(await screen.findByText(CATALOG)).toBeTruthy();
  });

  it("leaves the tab alone for a fragment that names nothing here", async () => {
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));
    expect(await screen.findByText(CATALOG)).toBeTruthy();
    // The skip link's target.
    followFragment("#main");
    expect(activeTab()).toBe("Pitfalls");
  });

  it("drops the fragment on a tab pick, so following the same link again still lands", async () => {
    window.history.replaceState(null, "", "/reference#b-cond");
    renderView();
    expect(activeTab()).toBe("Instructions");

    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/reference");
    expect(await screen.findByText(CATALOG)).toBeTruthy();

    followFragment("#b-cond");
    expect(activeTab()).toBe("Instructions");
  });

  it("keeps the fragment when the open tab is pressed again", () => {
    window.history.replaceState(null, "", "/reference#b-cond");
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: "Instructions" }));
    expect(window.location.hash).toBe("#b-cond");
  });

  it("opens the directives and debugger tab from its fragment, on load and when followed", async () => {
    window.history.replaceState(null, "", "#directives-and-debugger");
    const { unmount } = renderView();
    expect(activeTab()).toBe("Directives and debugger");
    expect(await screen.findByText("directives-and-debugger-guide")).toBeTruthy();
    unmount();

    window.history.replaceState(null, "", "/");
    renderView();
    fireEvent.click(screen.getByRole("tab", { name: "Pitfalls" }));
    expect(await screen.findByText(CATALOG)).toBeTruthy();
    followFragment("#directives-and-debugger");
    expect(await screen.findByText("directives-and-debugger-guide")).toBeTruthy();
    expect(screen.queryByText(CATALOG)).toBeNull();
  });

  it("ignores a fragment named after an inherited object key", () => {
    window.history.replaceState(null, "", "#constructor");
    renderView();
    expect(activeTab()).toBe("Instructions");
  });

  it("moves between sections with the arrow keys", async () => {
    renderView();
    const tablist = screen.getByRole("tablist");

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(activeTab()).toBe("Calling convention");
    expect(await screen.findByText(GUIDE)).toBeTruthy();

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(await screen.findByText(CATALOG)).toBeTruthy();
  });
});
