import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The client view is replaced with a text marker so this test exercises the
// server route wiring (data module -> page -> props) without pulling in the
// Tabs, markdown, diagram, or share stacks. The marker echoes the instruction
// count it receives, so the assertion proves the data actually flowed through.
vi.mock("@/components/ReferenceView", () => ({
  ReferenceView: ({ instructions }: { instructions: unknown[] }) =>
    `reference-view:${instructions.length}`,
}));

import { REFERENCE_INSTRUCTIONS } from "@/lib/reference-data";
import { SHARE_CARD_IMAGE } from "@/lib/site";
import ReferencePage, { metadata } from "./page";

afterEach(() => {
  cleanup();
});

describe("reference route", () => {
  it("renders the view from the full reference instruction set", () => {
    render(<ReferencePage />);
    expect(
      screen.getByText(`reference-view:${REFERENCE_INSTRUCTIONS.length}`),
    ).toBeTruthy();
  });

  it("keeps its per-route metadata", () => {
    expect(metadata.title).toBe("reference");
    expect(metadata.description).toBeTruthy();
    expect(metadata.openGraph).toBeTruthy();
    expect(metadata.twitter).toBeTruthy();
  });

  it("carries the shared cover on its restated cards", () => {
    // Cards do not deep-merge across segments, so a route that restates its
    // card without the image would unfurl with no cover.
    expect(metadata.openGraph?.images).toEqual([SHARE_CARD_IMAGE]);
    expect(metadata.twitter?.images).toEqual([SHARE_CARD_IMAGE]);
    expect(
      metadata.twitter && "card" in metadata.twitter && metadata.twitter.card,
    ).toBe("summary_large_image");
  });
});
