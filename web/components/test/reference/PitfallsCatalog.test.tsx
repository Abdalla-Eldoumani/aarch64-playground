import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PITFALLS } from "@/lib/content/pitfall-data";

// Stub the shared embeddable with a light marker that echoes the props the
// catalog feeds it, so the test never instantiates Monaco or the WASM worker.
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: { chrome?: string; startSource?: string }) => (
    <div
      data-testid="embed"
      data-chrome={props.chrome}
      data-startsource={props.startSource}
    />
  ),
}));

import { PitfallsCatalog } from "@/components/reference/PitfallsCatalog";

const THEMES = ["dark", "light", "high-contrast"] as const;

const TITLES = [
  "16-byte stack alignment",
  "saving and restoring fp and lr",
  "sign extension",
  "off-by-one loop bounds",
  "non-16-byte local allocation",
  "caller-saved registers do not survive a call",
  "misaligned stack at a call",
];

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

/** The embed stub appears asynchronously behind next/dynamic. */
const findEmbed = () => screen.findByTestId("embed");

describe("PitfallsCatalog", () => {
  it("renders the seven pitfall cards", () => {
    render(<PitfallsCatalog />);
    for (const title of TITLES) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it("labels a wrong and a right block on every card", () => {
    render(<PitfallsCatalog />);
    expect(screen.getAllByText("wrong")).toHaveLength(7);
    expect(screen.getAllByText("right")).toHaveLength(7);
  });

  it("renders a CodeBlock pre for each wrong and right snippet (fourteen total)", () => {
    const { container } = render(<PitfallsCatalog />);
    expect(container.querySelectorAll("pre")).toHaveLength(14);
  });

  it("shows the wrong vs right asm tokens for the alignment, sign, and loop traps", () => {
    const { container } = render(<PitfallsCatalog />);
    const text = container.textContent ?? "";
    // alignment: the misaligned vs aligned prologue allocation
    expect(text).toContain("[sp, -8]!");
    expect(text).toContain("[sp, -16]!");
    // sign extension: the fix introduces sxtw
    expect(text).toContain("sxtw    x0, w0");
    // off-by-one: the only change is the branch condition
    expect(text).toContain("b.gt    done");
    expect(text).toContain("b.ge    done");
  });

  it("accents wrong with --danger and right with --success tokens", () => {
    const { container } = render(<PitfallsCatalog />);
    const html = container.innerHTML;
    expect(html).toContain("var(--danger)");
    expect(html).toContain("var(--success)");
  });

  it("renders each cause through the real LessonMarkdown path", () => {
    const { container } = render(<PitfallsCatalog />);
    // a cause string only present if LessonMarkdown actually rendered the prose
    expect(container.textContent).toContain("bl overwrites lr");
  });

  it("offers a run-the-fault and run-the-fix affordance on every card", () => {
    render(<PitfallsCatalog />);
    for (const title of TITLES) {
      expect(
        screen.getByRole("button", { name: `run the fault: ${title}` }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: `run the fix: ${title}` }),
      ).toBeTruthy();
    }
  });

  it("running a fault seeds the faulty program and shows the watch line", async () => {
    render(<PitfallsCatalog />);
    fireEvent.click(
      screen.getByRole("button", { name: `run the fault: ${TITLES[0]}` }),
    );
    const embed = await findEmbed();
    expect(embed.getAttribute("data-chrome")).toBe("embed");
    expect(embed.getAttribute("data-startsource")).toBe(PITFALLS[0].fault);
    expect(screen.getByText(PITFALLS[0].watch)).toBeTruthy();
  });

  it("switching to the fix swaps the seeded program in place", async () => {
    render(<PitfallsCatalog />);
    fireEvent.click(
      screen.getByRole("button", { name: `run the fault: ${TITLES[3]}` }),
    );
    await findEmbed();
    fireEvent.click(
      screen.getByRole("button", { name: `run the fix: ${TITLES[3]}` }),
    );
    const embed = await findEmbed();
    expect(embed.getAttribute("data-startsource")).toBe(PITFALLS[3].fix);
  });

  it("only one demo is live at a time, and a second press closes it", async () => {
    render(<PitfallsCatalog />);
    const first = screen.getByRole("button", {
      name: `run the fault: ${TITLES[0]}`,
    });
    fireEvent.click(first);
    await findEmbed();
    // Opening another card's demo closes the first: still one embed.
    fireEvent.click(
      screen.getByRole("button", { name: `run the fix: ${TITLES[1]}` }),
    );
    const embed = await findEmbed();
    expect(screen.getAllByTestId("embed")).toHaveLength(1);
    expect(embed.getAttribute("data-startsource")).toBe(PITFALLS[1].fix);
    // Pressing the open card's button again closes the demo entirely.
    fireEvent.click(
      screen.getByRole("button", { name: `close the demo: ${TITLES[1]}` }),
    );
    expect(screen.queryByTestId("embed")).toBeNull();
  });

  it("exposes an accessible name", () => {
    render(<PitfallsCatalog />);
    expect(screen.getByLabelText("cpsc 355 pitfalls")).toBeTruthy();
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<PitfallsCatalog />);
      expect(screen.getByLabelText("cpsc 355 pitfalls")).toBeTruthy();
      unmount();
    }
  });
});
