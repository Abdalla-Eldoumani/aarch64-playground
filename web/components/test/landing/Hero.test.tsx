import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Stub the shared embeddable: record the props the hero feeds it and render a
// light marker, so the test never instantiates Monaco / WASM. The hero
// composes the embed, so the props it passes are what there is to assert.
const embed = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));
vi.mock("@/components/playground/EmbeddablePlayground", () => ({
  EmbeddablePlayground: (props: Record<string, unknown>) => {
    embed.props = props;
    return <div data-testid="embed" />;
  },
}));

import { Hero } from "@/components/landing/Hero";
import { HERO_PROGRAM } from "@/lib/content/landing-content";

afterEach(() => {
  cleanup();
  embed.props = null;
});

describe("Hero", () => {
  it("points the main link at the playground with an example preloaded", () => {
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
    // The hero is the one surface that draws its program without the editor,
    // so the landing never loads Monaco.
    expect(embed.props!.staticEditor).toBeTruthy();
    // The autoplay was built for two buttons, so no step and no back.
    expect(embed.props!.showStep).toBe(false);
    expect(embed.props!.showBack).toBe(false);
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
