import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// The client view is replaced with a text marker so this test exercises the
// server route wiring (data module -> page -> props) without pulling in the
// Tabs, markdown, diagram, or share stacks. The marker echoes the instruction
// and lesson counts it receives, so the assertion proves the data flowed through.
vi.mock("@/components/reference/ReferenceView", () => ({
  ReferenceView: ({
    instructions,
    lessonTitles,
  }: {
    instructions: unknown[];
    lessonTitles: Record<string, string>;
  }) => `reference-view:${instructions.length}:${Object.keys(lessonTitles).length}`,
}));

import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { loadLessonIndex } from "@/lib/content/lessons";
import { SHARE_CARD_IMAGE } from "@/lib/content/site";
import ReferencePage, { metadata } from "./page";

afterEach(() => {
  cleanup();
});

describe("reference route", () => {
  it("renders the view from the full instruction set and every lesson title", () => {
    render(<ReferencePage />);
    expect(
      screen.getByText(
        `reference-view:${REFERENCE_INSTRUCTIONS.length}:${loadLessonIndex().length}`,
      ),
    ).toBeTruthy();
  });

  it("keeps its per-route metadata", () => {
    expect(metadata.title).toEqual({ absolute: "AArch64 instruction reference · AArch64 Playground" });
    expect(metadata.description).toBeTruthy();
    expect(metadata.openGraph).toBeTruthy();
    expect(metadata.twitter).toBeTruthy();
  });

  it("keeps the shared cover image on the share cards it sets", () => {
    // Next.js does not merge a route's share card with the parent's, so a
    // route that sets its own card without the image shares with no picture.
    expect(metadata.openGraph?.images).toEqual([SHARE_CARD_IMAGE]);
    expect(metadata.twitter?.images).toEqual([SHARE_CARD_IMAGE]);
    expect(
      metadata.twitter && "card" in metadata.twitter && metadata.twitter.card,
    ).toBe("summary_large_image");
  });
});
