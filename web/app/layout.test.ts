import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL } from "@/lib/content/site";

// next/font/google only runs inside the Next build; stub the three loaders so
// the layout module can be imported for its metadata export. Each stub keeps
// the options it was called with, because those options are the font
// configuration, and every face declared there lands in a render-blocking
// stylesheet on every route. The options are kept in a plain record rather
// than read back from mock call history: the loaders run once, at import,
// and vitest clears every mock's history before each test.
interface FontOptions {
  weight?: string[];
  style?: string[];
  display?: string;
}

type FontLoader = (options: FontOptions) => { variable: string };

const fonts = vi.hoisted(() => {
  const declared: { sans?: FontOptions; mono?: FontOptions; serif?: FontOptions } = {};
  const loader =
    (name: keyof typeof declared, variable: string): FontLoader =>
    (options) => {
      declared[name] = options;
      return { variable };
    };
  return {
    declared,
    plexSans: loader("sans", "--font-sans"),
    jetBrainsMono: loader("mono", "--font-mono"),
    sourceSerif: loader("serif", "--font-serif"),
  };
});
vi.mock("next/font/google", () => ({
  IBM_Plex_Sans: fonts.plexSans,
  JetBrains_Mono: fonts.jetBrainsMono,
  Source_Serif_4: fonts.sourceSerif,
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

  it("advertises the site root as its own canonical, relative to that origin", () => {
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("composes route titles with a middle dot, never an em dash", () => {
    const title = metadata.title;
    const template =
      title && typeof title === "object" && "template" in title ? title.template : null;
    expect(template).toBe("%s · cpsc 355 playground");
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

// A stray face costs every route: the next/font stylesheet is
// render-blocking.
describe("font declarations", () => {
  it("declares the serif upright only", () => {
    const options = fonts.declared.serif!;
    expect(options.style).toBeUndefined();
    expect(options.weight).toEqual(["400", "600"]);
  });

  it("declares all four weights for the sans and the mono", () => {
    expect(fonts.declared.sans!.weight).toEqual(["400", "500", "600", "700"]);
    expect(fonts.declared.mono!.weight).toEqual(["400", "500", "600", "700"]);
  });

  it("swaps every family, so no face blocks first paint", () => {
    for (const options of [fonts.declared.serif, fonts.declared.sans, fonts.declared.mono]) {
      expect(options!.display).toBe("swap");
    }
  });
});
