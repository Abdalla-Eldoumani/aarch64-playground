import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { ThemeControl } from "@/components/chrome/ThemeControl";

afterEach(() => cleanup());

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeControl", () => {
  it("renders one option per theme with full accessible names", () => {
    render(<ThemeControl />);
    for (const id of ["dark", "light", "high-contrast", "ember", "forest", "paper"]) {
      expect(screen.getByRole("button", { name: `${id} theme` })).toBeTruthy();
    }
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("marks exactly one option active with aria-pressed (the default)", () => {
    render(<ThemeControl />);
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    // matchMedia is stubbed to "not light" and localStorage is cleared, so the
    // hook's default resolves to dark.
    expect(pressed[0].getAttribute("aria-label")).toBe("dark theme");
  });

  it("presses no option in the server HTML, since the server cannot know the theme", () => {
    const html = renderToStaticMarkup(<ThemeControl />);
    expect(html).toContain('aria-label="dark theme"');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(6);
  });

  it("hydrates that HTML with nothing logged, then presses the resolved theme", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ThemeControl />);
    document.body.appendChild(container);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const recovered: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <ThemeControl />, { onRecoverableError: (e) => recovered.push(e) });
    });
    expect(recovered).toEqual([]);
    expect(logged.mock.calls.map((c) => String(c[0]))).toEqual([]);
    const pressed = [...container.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label"));
    expect(pressed).toEqual([`${document.documentElement.getAttribute("data-theme")} theme`]);
    logged.mockRestore();
    act(() => root?.unmount());
    container.remove();
  });

  it("selecting light sets data-theme=light and moves aria-pressed", () => {
    render(<ThemeControl />);
    const light = screen.getByRole("button", { name: "light theme" });
    fireEvent.click(light);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(light.getAttribute("aria-pressed")).toBe("true");
  });
});
