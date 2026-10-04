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

    // jsdom's fireEvent.click does not move focus, so focus the trigger first.
    // Otherwise useFocusTrap captures <body> as the previously-focused element
    // and the focus-return assertion below would fail for the wrong reason.
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

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

  // The drawer covers the toggle that opened it, so the same spot has to
  // close it: a close button sits there, and focus starts on it rather than
  // on a link that could read as a second current page.
  it("opens on a close button that shuts the drawer and gives focus back to the toggle", () => {
    render(<MobileNavDrawer />);
    const trigger = screen.getByRole("button", { name: "open navigation" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "close navigation" });
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  // WebKit does not focus a button it taps, so the focus trap has nothing to
  // give back; the toggle still has to get it.
  it("gives focus to the toggle on Escape when the opening tap left it on the page", () => {
    render(<MobileNavDrawer />);
    const trigger = screen.getByRole("button", { name: "open navigation" });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("holds the page still while open and puts back the page's own overflow after", () => {
    document.body.style.overflow = "scroll";
    render(<MobileNavDrawer />);
    fireEvent.click(screen.getByRole("button", { name: "open navigation" }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
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
    expect(within(dialog).getAllByRole("radio")).toHaveLength(10);
    expect(within(dialog).getByRole("radiogroup", { name: "theme" })).toBeTruthy();
  });

  // The short-window playground band drops the site bar at every width, so
  // its menu cannot hide at md.
  it("shows at every width when asked to", () => {
    const { container } = render(<MobileNavDrawer everywhere />);
    expect(container.firstElementChild?.className ?? "").not.toContain("md:hidden");
    expect(screen.getByRole("button", { name: "open navigation" })).toBeTruthy();
  });
});
