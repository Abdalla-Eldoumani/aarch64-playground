// Pins the theme chooser: one radiogroup of ten swatches (keys, names, the
// server markup and hydration), and the site bar's button that opens it
// sideways and closes on Escape, a press outside, or tabbing away.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { ThemeControl } from "@/components/chrome/ThemeControl";

afterEach(() => cleanup());

// use-theme keeps one store for the page, so each test starts back on dark.
beforeEach(() => {
  render(<ThemeControl size="comfortable" />);
  fireEvent.click(screen.getByRole("radio", { name: "dark" }));
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

const NAMES = ["dark", "light", "high contrast", "midnight", "ember", "forest", "dusk", "paper", "glacier", "rose"];

function checkedName(): string | null {
  return screen.getAllByRole("radio").find((r) => r.getAttribute("aria-checked") === "true")?.getAttribute("aria-label") ?? null;
}

describe("ThemeControl in the phone menus", () => {
  it("is one radiogroup named theme, a radio per theme named by its label", () => {
    render(<ThemeControl size="comfortable" />);
    const group = screen.getByRole("radiogroup", { name: "theme" });
    expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(NAMES);
  });

  it("checks exactly one swatch, the current theme, and gives only it the tab stop", () => {
    render(<ThemeControl size="comfortable" />);
    expect(checkedName()).toBe("dark");
    const tabbable = screen.getAllByRole("radio").filter((r) => r.tabIndex === 0);
    expect(tabbable.map((r) => r.getAttribute("aria-label"))).toEqual(["dark"]);
  });

  it("checks no swatch in the server HTML, since the server cannot know the theme", () => {
    const html = renderToStaticMarkup(<ThemeControl size="comfortable" />);
    expect(html).not.toContain('aria-checked="true"');
    expect(html.match(/aria-checked="false"/g)).toHaveLength(10);
    // The sliding frame says which one is current, so it waits for hydration.
    expect(html).not.toContain("theme-marker");
  });

  it("hydrates that HTML with nothing logged, then checks the resolved theme", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ThemeControl size="comfortable" />);
    document.body.appendChild(container);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const recovered: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <ThemeControl size="comfortable" />, { onRecoverableError: (e) => recovered.push(e) });
    });
    expect(recovered).toEqual([]);
    expect(logged.mock.calls.map((c) => String(c[0]))).toEqual([]);
    const checked = [...container.querySelectorAll('[role="radio"][aria-checked="true"]')].map((b) => b.getAttribute("aria-label"));
    expect(checked).toEqual([document.documentElement.getAttribute("data-theme")]);
    logged.mockRestore();
    act(() => root?.unmount());
    container.remove();
  });

  it("applies a clicked swatch and slides the frame to it, across its two rows of five", () => {
    const { container } = render(<ThemeControl size="comfortable" />);
    const frame = () => (container.querySelector(".theme-marker") as HTMLElement).style.transform;
    expect((container.querySelector('[role="radiogroup"]') as HTMLElement).style.gridTemplateColumns).toBe("repeat(5, auto)");
    fireEvent.click(screen.getByRole("radio", { name: "light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(checkedName()).toBe("light");
    expect(frame()).toBe("translate(100%, 0%)");
    fireEvent.click(screen.getByRole("radio", { name: "dusk" }));
    expect(frame()).toBe("translate(100%, 100%)");
  });

  it("moves and chooses with the arrows, wrapping, and jumps with Home and End", () => {
    render(<ThemeControl size="comfortable" />);
    const group = screen.getByRole("radiogroup", { name: "theme" });
    const press = (key: string) => fireEvent.keyDown(document.activeElement ?? group, { key });
    screen.getByRole("radio", { name: "dark" }).focus();
    press("ArrowLeft");
    expect(checkedName()).toBe("rose");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("rose");
    press("ArrowRight");
    press("ArrowDown");
    expect(checkedName()).toBe("light");
    press("ArrowUp");
    expect(checkedName()).toBe("dark");
    press("End");
    expect(checkedName()).toBe("rose");
    // The end of the first row steps on to the start of the second.
    fireEvent.click(screen.getByRole("radio", { name: "ember" }));
    screen.getByRole("radio", { name: "ember" }).focus();
    press("ArrowRight");
    expect(checkedName()).toBe("forest");
    press("Home");
    expect(checkedName()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("ThemeControl in the site bar", () => {
  function bar() {
    render(
      <>
        <ThemeControl />
        <button type="button">elsewhere</button>
      </>,
    );
    return {
      button: screen.getByRole("button", { name: /^theme/ }),
      strip: screen.getByRole("radiogroup", { name: "theme" }),
    };
  }

  it("names no theme in the server HTML, and starts closed", () => {
    const html = renderToStaticMarkup(<ThemeControl />);
    expect(html).toContain('aria-label="theme"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-open="false"');
  });

  it("names the current theme once hydrated and controls the closed, inert row", () => {
    const { button, strip } = bar();
    expect(button.getAttribute("aria-label")).toBe("theme: dark");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(strip.id);
    expect(strip.hasAttribute("inert")).toBe(true);
    expect(strip.getAttribute("data-open")).toBe("false");
  });

  it("opens on the button, hands focus to the checked swatch, and stays open on a choice", () => {
    const { button, strip } = bar();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(strip.hasAttribute("inert")).toBe(false);
    // Ten fit in one row beside the button at every width the bar shows it.
    expect(strip.style.gridTemplateColumns).toBe("repeat(10, auto)");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("dark");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    fireEvent.click(screen.getByRole("radio", { name: "ember" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("ember");
    expect(button.getAttribute("aria-label")).toBe("theme: ember");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(window.localStorage.getItem("aarch64-playground:theme")).toBe("ember");
  });

  it("closes on Escape and gives focus back to the button", () => {
    const { button } = bar();
    fireEvent.click(button);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes on a press outside, not on one inside", () => {
    const { button } = bar();
    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByRole("radio", { name: "forest" }));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when focus tabs out of it", () => {
    const { button } = bar();
    fireEvent.click(button);
    fireEvent.focusOut(document.activeElement!, { relatedTarget: button });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.focusOut(document.activeElement!, { relatedTarget: screen.getByRole("button", { name: "elsewhere" }) });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles closed from the button", () => {
    const { button } = bar();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
