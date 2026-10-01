// Pins the heading case on every route: h1 to h3 as each route renders them,
// the reference's tabs and the playground's tabs and dialogs included.
// A heading set in the display faces is sentence case: a capital first
// letter, then lower case except for acronyms, names, and code. A heading
// that opens with code (a mnemonic, a C library call, argc, m4) keeps the
// code's spelling. A label heading, the small mono kind that CSS sets in
// capitals like the kickers, is written in lower case, as the kickers are.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// Monaco, xterm and the panel library cannot run in jsdom; the rest of the
// playground renders for real over the typed fake hub.
vi.mock("@/components/playground/lazy-editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/panels/TerminalPane", () => ({ TerminalPane: () => null }));
// The site bar holds no heading, and it needs the Next router for its links.
vi.mock("@/components/chrome/SiteNav", () => ({ SiteNav: () => null }));
vi.mock("@/components/playground/ResizableLayout", () => ({
  ResizableLayout: (slots: Record<"editor" | "disassembly" | "registers" | "rightTabs", ReactNode>) => (
    <div>
      {slots.editor}
      {slots.disassembly}
      {slots.registers}
      {slots.rightTabs}
    </div>
  ),
  PaneSplit: ({ first, second }: { first: ReactNode; second: ReactNode }) => (
    <div>
      {first}
      {second}
    </div>
  ),
  EDITOR_SPLIT: { label: "resize editor and disassembly" },
  DEBUG_SPLIT: { label: "resize registers and tabs" },
}));
vi.mock("@/lib/playground/vfs-persist", () => ({
  loadPersistedVfs: async () => null,
  savePersistedVfs: async () => {},
}));
const useEmulatorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/emulator/use-emulator", () => ({ useEmulator: useEmulatorMock }));

// The real loaders, read once as the file loads (one read opens every file).
vi.mock("@/lib/content/exercises", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content/exercises")>();
  const all = real.loadAllExercises();
  const index = real.loadExerciseIndex();
  return {
    ...real,
    loadAllExercises: () => all,
    loadExerciseIndex: () => index,
    loadExercise: (slug: string) => all.find((exercise) => exercise.slug === slug),
  };
});
vi.mock("@/lib/content/lessons", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content/lessons")>();
  const all = real.loadAllLessons();
  const index = real.loadLessonIndex();
  return {
    ...real,
    loadAllLessons: () => all,
    loadLessonIndex: () => index,
    loadLesson: (slug: string) => all.find((lesson) => lesson.slug === slug),
  };
});

import LandingPage from "./(site)/page";
import LearnPage from "./(site)/learn/page";
import LessonPage, { generateStaticParams as lessonSlugs } from "./(site)/learn/[slug]/page";
import PracticePage from "./(site)/practice/page";
import ExercisePage, { generateStaticParams as exerciseSlugs } from "./(site)/practice/[slug]/page";
import ReferencePage from "./(site)/reference/page";
import PlaygroundPage from "./playground/page";
import ErrorPage from "./error";
import GlobalErrorPage from "./global-error";
import { NotFound } from "@/components/chrome/NotFound";
import { makeHub } from "@/components/test/playground/helpers/emulator-hub";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";

// Code a heading may open with, in its own spelling: mnemonics, condition
// codes (the pitfall cards open with lt and friends), and a few names.
const CODE_OPENERS = new Set([
  ...REFERENCE_INSTRUCTIONS.map((instruction) => instruction.mnemonic.toLowerCase()),
  ..."eq ne cs hs cc lo mi pl vs vc hi ls ge lt gt le al".split(" "),
  "argc",
  "argv",
  "gcd",
  "m4",
  "printf",
  "scanf",
]);
/** A general-purpose register name, x0 to x30 or w0 to w30. */
const REGISTER = /^[xw]([12]?\d|30)$/;
// Names that keep their capital in the middle of a heading.
const NAMES = new Set(["Euclid", "Hanoi"]);

/** Two or more capitals (ARMv8, IEEE-754, NaN) or one lone capital (C). */
function isAcronym(word: string): boolean {
  return (word.match(/[A-Z]/g) ?? []).length >= 2 || /^[A-Z]$/.test(word);
}

/** The word without the punctuation around it ("(alias", "lr," and "it?"). */
function bare(word: string): string {
  return word.replace(/^[^A-Za-z0-9.%#]+/, "").replace(/[^A-Za-z0-9%']+$/, "");
}

/** Why a heading breaks the case rule, or null when it keeps it. */
function caseProblem(heading: HTMLElement): string | null {
  const words = (heading.textContent ?? "").split(/\s+/).map(bare).filter(Boolean);
  if (words.length === 0) return null;
  if (heading.classList.contains("uppercase")) {
    const capitals = words.filter((word) => /^[A-Z]/.test(word) && !isAcronym(word));
    return capitals.length > 0 ? `label heading has capitals: ${capitals.join(", ")}` : null;
  }
  const [first, ...rest] = words;
  if (/^[a-z]/.test(first) && !CODE_OPENERS.has(first.toLowerCase()) && !REGISTER.test(first)) {
    return `opens in lower case: ${first}`;
  }
  const titled = rest.filter((word) => /^[A-Z]/.test(word) && !isAcronym(word) && !NAMES.has(word));
  return titled.length > 0 ? `title case: ${titled.join(", ")}` : null;
}

/** Every h1 to h3 under `root` that breaks the rule, with the reason. A root
 *  with no heading at all is reported too, so a route that failed to render
 *  cannot pass by having nothing to check. */
function problems(root: ParentNode): string[] {
  const headings = [...root.querySelectorAll<HTMLElement>("h1, h2, h3")];
  if (headings.length === 0) return ["no h1 to h3 rendered"];
  return headings
    .map((heading) => {
      const why = caseProblem(heading);
      return why && `<${heading.tagName.toLowerCase()}> "${heading.textContent?.trim()}": ${why}`;
    })
    .filter((line): line is string => Boolean(line));
}

beforeAll(async () => {
  await import("@/components/playground/FullChromeSurface");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("the case rule itself", () => {
  function heading(tag: string, text: string, className = ""): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }

  it("passes sentence case, code openers, acronyms, names, and lower-case labels", () => {
    expect(caseProblem(heading("h1", "Inside a float: IEEE 754"))).toBeNull();
    expect(caseProblem(heading("h2", "argc and argv"))).toBeNull();
    expect(caseProblem(heading("h3", "x16 and x17 can change"))).toBeNull();
    expect(caseProblem(heading("h3", "lt, le, gt, ge are signed"))).toBeNull();
    expect(caseProblem(heading("h1", "gcd, the Euclid way"))).toBeNull();
    expect(caseProblem(heading("h2", "Calling C from assembly"))).toBeNull();
    expect(caseProblem(heading("h2", "register file · aapcs64", "uppercase"))).toBeNull();
    expect(caseProblem(heading("h3", "IEEE-754 float", "uppercase"))).toBeNull();
  });

  it("fails a lower-case opener, title case, and a capital in a label", () => {
    expect(caseProblem(heading("h1", "page not found"))).toMatch(/lower case/);
    expect(caseProblem(heading("h2", "x31 is not a register"))).toMatch(/lower case/);
    expect(caseProblem(heading("h3", "Multiple Choice"))).toMatch(/title case/);
    expect(caseProblem(heading("h2", "Specification", "uppercase"))).toMatch(/capitals/);
  });
});

describe("every route keeps the heading case", () => {
  it("/", () => {
    const { container } = render(<LandingPage />);
    expect(problems(container)).toEqual([]);
  });

  it("/learn", () => {
    const { container } = render(<LearnPage />);
    expect(problems(container)).toEqual([]);
  });

  it.each(lessonSlugs().map(({ slug }) => [slug]))("/learn/%s", async (slug) => {
    const { container } = render(await LessonPage({ params: Promise.resolve({ slug }) }));
    expect(problems(container)).toEqual([]);
  });

  it("/practice", () => {
    const { container } = render(<PracticePage />);
    expect(problems(container)).toEqual([]);
  });

  it.each(exerciseSlugs().map(({ slug }) => [slug]))("/practice/%s", async (slug) => {
    const { container } = render(await ExercisePage({ params: Promise.resolve({ slug }) }));
    expect(problems(container)).toEqual([]);
  });

  it("/reference, on every tab", async () => {
    const { container } = render(<ReferencePage />);
    const found = problems(container);
    // Each of these tabs loads behind next/dynamic, so wait for a heading
    // only the loaded panel carries before checking it.
    const loaded: [string, string][] = [
      ["Calling convention", "Integer registers"],
      ["Pitfalls", "Registers and values"],
      ["Converter", "base converter"],
    ];
    for (const [name, heading] of loaded) {
      fireEvent.click(screen.getByRole("tab", { name }));
      await screen.findByRole("heading", { name: heading }, { timeout: 10_000 });
      found.push(...problems(container));
    }
    expect(found).toEqual([]);
    // Three lazy tabs, each allowed 10 s above, outlast the 5 s default.
  }, 30_000);

  it("/playground, on every tab and in its dialogs", async () => {
    useEmulatorMock.mockReturnValue(makeHub());
    const { container } = render(<PlaygroundPage />);
    const tabs = await screen.findAllByRole("tab");
    const found = problems(document.body);
    for (const tab of tabs) {
      fireEvent.click(tab);
      found.push(...problems(container));
    }
    fireEvent.click(screen.getAllByRole("button", { name: "diagnostic bundle" })[0]);
    await waitFor(() => expect(document.getElementById("diagnostic-bundle-title")).not.toBeNull());
    found.push(...problems(document.body));
    act(() => {
      fireEvent.keyDown(window, { key: "?" });
    });
    await screen.findByRole("dialog", { name: "keyboard shortcuts" });
    found.push(...problems(document.body));
    expect(found).toEqual([]);
  });

  it("the 404 page", () => {
    const { container } = render(<NotFound />);
    expect(problems(container)).toEqual([]);
  });

  it("the error pages", () => {
    const failure = Object.assign(new Error("boom"), { digest: "x" });
    const { container } = render(<ErrorPage error={failure} reset={() => {}} />);
    expect(problems(container)).toEqual([]);
    cleanup();
    const global = render(<GlobalErrorPage error={failure} reset={() => {}} />);
    expect(problems(global.container)).toEqual([]);
  });
});
