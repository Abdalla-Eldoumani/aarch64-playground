import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Stub the four sections so this test proves only the page's composition --
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
vi.mock("@/components/CredibilitySection", async () => {
  const React = await import("react");
  return {
    CredibilitySection: () =>
      React.createElement("div", { "data-testid": "credibility" }),
  };
});

import LandingPage from "./page";

afterEach(() => cleanup());

describe("landing composition", () => {
  it("renders the hero, routes, catalog, and credibility sections", () => {
    render(<LandingPage />);
    expect(screen.getByTestId("hero")).toBeTruthy();
    expect(screen.getByTestId("routes")).toBeTruthy();
    expect(screen.getByTestId("catalog")).toBeTruthy();
    expect(screen.getByTestId("credibility")).toBeTruthy();
  });

  it("stacks the sections in document order", () => {
    const { container } = render(<LandingPage />);
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(order).toEqual(["hero", "routes", "catalog", "credibility"]);
  });
});
