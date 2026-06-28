import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Stub the shared embeddable: record the props the hero feeds it and render a
// light marker, so the test never instantiates Monaco / WASM. The hero's
// contract is that it composes the embed (not forks it), so asserting the
// props it passes is the meaningful check.
const embed = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));
vi.mock("@/components/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: Record<string, unknown>) => {
    embed.props = props;
    return <div data-testid="embed" />;
  },
}));

import { Hero } from "./Hero";
import { HERO_PROGRAM } from "@/lib/landing-content";

afterEach(() => {
  cleanup();
  embed.props = null;
});

describe("Hero", () => {
  it("deep-links the primary CTA into the playground with an example preloaded", () => {
    render(<Hero />);
    const cta = screen.getByRole("link", {
      name: /open this example in the playground/i,
    });
    expect(cta.getAttribute("href")).toBe("/playground?example=basics");
  });

  it("composes the embeddable in embed chrome with autoplay, readOnly, and the hero program", () => {
    render(<Hero />);
    expect(screen.getByTestId("embed")).toBeTruthy();
    expect(embed.props).not.toBeNull();
    expect(embed.props!.chrome).toBe("embed");
    expect(embed.props!.autoplay).toBeTruthy();
    expect(embed.props!.readOnly).toBeTruthy();
    // The start program is fed from the single landing-content source, not
    // inlined, so the hero and the data module can never disagree.
    expect(embed.props!.startSource).toBe(HERO_PROGRAM);
    expect(typeof embed.props!.startSource).toBe("string");
    expect((embed.props!.startSource as string).length).toBeGreaterThan(0);
  });

  it("renders a heading", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});
