import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FeatureCatalog } from "@/components/landing/FeatureCatalog";
import { FEATURES } from "@/lib/content/landing-content";

afterEach(() => cleanup());

describe("FeatureCatalog", () => {
  it("renders exactly one card per FEATURES entry (the count is data-driven)", () => {
    render(<FeatureCatalog />);
    const cards = screen.getAllByTestId("feature-card");
    // Tracking FEATURES.length proves the grid is not hardcoded to a fixed
    // count: add an entry and a card appears with no component change.
    expect(cards).toHaveLength(FEATURES.length);
  });

  it("renders each feature's title and description", () => {
    render(<FeatureCatalog />);
    for (const feature of FEATURES) {
      expect(screen.getByText(feature.title)).toBeTruthy();
      expect(screen.getByText(feature.description)).toBeTruthy();
    }
  });

  it("renders a heading", () => {
    render(<FeatureCatalog />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
  });
});
