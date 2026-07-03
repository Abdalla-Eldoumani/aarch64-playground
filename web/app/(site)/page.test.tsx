import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CREDIBILITY } from "@/lib/site";

// Stub the three sections so this test proves only the page's composition --
// the order it stacks them in -- without pulling Monaco, the WASM worker, or the
// shared embeddable through the live Hero. Each section has its own test; here
// each is a lightweight marker carrying a unique data-testid.
vi.mock("@/components/Hero", async () => {
  const React = await import("react");
  return { Hero: () => React.createElement("div", { "data-testid": "hero" }) };
});
vi.mock("@/components/RoutesRegisterFile", async () => {
  const React = await import("react");
  return {
    RoutesRegisterFile: () =>
      React.createElement("div", { "data-testid": "routes" }),
  };
});
vi.mock("@/components/FeatureCatalog", async () => {
  const React = await import("react");
  return {
    FeatureCatalog: () =>
      React.createElement("div", { "data-testid": "catalog" }),
  };
});

import LandingPage from "./page";

afterEach(() => cleanup());

describe("landing composition", () => {
  it("renders the hero, routes, and catalog sections", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("hero")).toBeTruthy();
    expect(screen.getByTestId("routes")).toBeTruthy();
    expect(screen.getByTestId("catalog")).toBeTruthy();
  });

  it("stacks the sections in document order", () => {
    const { container } = render(<LandingPage />);
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(order).toEqual(["hero", "routes", "catalog"]);
  });

  it("ships no footer of its own; the single footer comes from the layout", () => {
    render(<LandingPage />);
    // The landing once stacked a credibility band -- repository, license, and
    // the disclaimer again -- directly above the layout footer, reading as two
    // footers. The footer now carries those facts, so the page must not restate
    // any of them.
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByText(new RegExp(CREDIBILITY.disclaimer))).toBeNull();
  });
});
