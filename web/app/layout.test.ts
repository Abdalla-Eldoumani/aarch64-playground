import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";

// next/font/google only runs inside the Next build; stub the three loaders so
// the layout module can be imported for its metadata export.
vi.mock("next/font/google", () => ({
  Hanken_Grotesk: () => ({ variable: "--font-sans" }),
  JetBrains_Mono: () => ({ variable: "--font-mono" }),
  Source_Serif_4: () => ({ variable: "--font-serif" }),
}));

import { metadata } from "./layout";

interface CardImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

function asImages(value: unknown): CardImage[] {
  return (Array.isArray(value) ? value : [value]) as CardImage[];
}

describe("share card metadata", () => {
  it("anchors relative URLs to the production origin", () => {
    const base = metadata.metadataBase;
    expect(base).toBeInstanceOf(URL);
    expect((base as URL).origin).toBe(SITE_URL);
  });

  it("carries a complete open graph card", () => {
    const og = metadata.openGraph;
    expect(og?.title).toBe("cpsc 355 playground");
    expect(og?.description).toBeTruthy();
    expect(og?.siteName).toBe("cpsc 355 playground");
    expect(og?.url).toBe("/");
    expect(og && "type" in og && og.type).toBe("website");
  });

  it("declares the cover image with its dimensions and alt text", () => {
    const [image] = asImages(metadata.openGraph?.images);
    expect(image.url).toBe("/og.png");
    expect(image.width).toBe(1200);
    expect(image.height).toBe(630);
    expect(image.alt).toBeTruthy();
  });

  it("asks messengers for the large-image twitter card with the same cover", () => {
    const twitter = metadata.twitter;
    expect(twitter && "card" in twitter && twitter.card).toBe(
      "summary_large_image",
    );
    expect(twitter?.title).toBe("cpsc 355 playground");
    expect(twitter?.description).toBeTruthy();
    const [image] = asImages(twitter?.images);
    expect(image.url).toBe("/og.png");
  });

  it("ships the cover the tags advertise: a real 1200x630 png, light enough to unfurl", () => {
    // Vitest runs from web/, so the public dir sits under the cwd.
    const png = readFileSync(join(process.cwd(), "public", "og.png"));
    // PNG signature, then width and height straight from the IHDR chunk, so
    // the asset on disk can never drift from the dimensions the tags declare.
    expect([...png.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.byteLength).toBeLessThan(300 * 1024);
  });
});
