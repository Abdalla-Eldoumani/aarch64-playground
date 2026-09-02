import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

// usePathname must resolve to a real route so the active-route assertion below is
// meaningful; "/learn" is one of the four nav routes.
vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
}));

import { MobileNavDrawer } from "@/components/chrome/MobileNavDrawer";
import { NAV_ROUTES } from "@/lib/content/site";

afterEach(() => cleanup());

describe("MobileNavDrawer", () => {
  it("opens an accessible drawer, marks the active route, and returns focus on Escape", () => {
    render(<MobileNavDrawer />);

    const trigger = screen.getByRole("button", { name: "open navigation" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();

    // jsdom's fireEvent.click does NOT move focus, so focus the trigger first.
    // Otherwise useFocusTrap captures <body> as the previously-focused element
    // and the focus-return assertion below would fail for the wrong reason.
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // All four routes render as links with their href; exactly the current
    // route (/learn) carries aria-current="page".
    expect(NAV_ROUTES).toHaveLength(4);
    for (const route of NAV_ROUTES) {
      const link = within(dialog).getByRole("link", { name: route.label });
      expect(link.getAttribute("href")).toBe(route.href);
      expect(link.getAttribute("aria-current")).toBe(
        route.href === "/learn" ? "page" : null,
      );
    }

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("appends the formatted star count to the source row when one is passed", () => {
    render(<MobileNavDrawer stars={1204} />);
    fireEvent.click(screen.getByRole("button", { name: "open navigation" }));

    const dialog = screen.getByRole("dialog");
    const github = within(dialog).getByRole("link", {
      name: "source on github, 1204 stars",
    });
    // One anchor: the row text and the count share it.
    expect(github.textContent).toBe("source on github1.2k");
  });

  it("carries the theme control the bar drops, inside an md:hidden root", () => {
    const { container } = render(<MobileNavDrawer />);
    expect(container.firstElementChild?.className).toContain("md:hidden");
    fireEvent.click(screen.getByRole("button", { name: "open navigation" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("group", { name: "theme" })).toBeTruthy();
  });
});
