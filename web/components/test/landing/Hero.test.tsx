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
import { readShareHash } from "@/lib/playground/share";

afterEach(() => {
  cleanup();
  embed.props = null;
});

describe("Hero", () => {
  it("opens the program the demo walks, carried in the link itself", () => {
    render(<Hero />);
    const cta = screen.getByRole("link", {
      name: /open this example in the playground/i,
    });
    const href = cta.getAttribute("href") ?? "";
    expect(href.startsWith("/playground#p2=")).toBe(true);
    // Read back the way the playground reads a share link on boot.
    expect(readShareHash(href.slice("/playground".length))).toEqual({
      kind: "ok",
      state: { source: HERO_PROGRAM },
    });
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
    // The walk has its own control in the title bar, so no step and no back.
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
