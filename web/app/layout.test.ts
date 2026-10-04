import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { SITE_URL } from "@/lib/content/site";

// next/font/local runs only inside the Next build. The stub records each
// call's options in a plain object, not mock call history: the loader runs
// once per font at import, and vitest clears call history before each test.
interface FontOptions {
  src: string;
  weight?: string;
  style?: string;
  display?: string;
  variable: string;
}

const fonts = vi.hoisted(() => {
  const declared: Record<string, FontOptions> = {};
  return {
    declared,
    localFont: (options: FontOptions) => {
      declared[options.variable] = options;
      return { variable: options.variable };
    },
  };
});
vi.mock("next/font/local", () => ({ default: fonts.localFont }));

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
    expect(template).toBe("%s · AArch64 Playground");
  });

  it("falls back to the home page's title and snippet", () => {
    const title = metadata.title;
    const fallback = title && typeof title === "object" && "default" in title ? title.default : null;
    expect(fallback).toBe("ARMv8 assembly emulator and debugger · AArch64 Playground");
    expect(metadata.description).toContain("CPSC 355");
  });

  it("carries a complete open graph card", () => {
    const og = metadata.openGraph;
    expect(og?.title).toBe("ARMv8 assembly emulator and debugger · AArch64 Playground");
    expect(og?.description).toBeTruthy();
    expect(og?.siteName).toBe("AArch64 Playground");
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
    expect(twitter?.title).toBe("ARMv8 assembly emulator and debugger · AArch64 Playground");
    expect(twitter?.description).toBeTruthy();
    const [image] = asImages(twitter?.images);
    expect(image.url).toBe("/og.png");
  });

  it("ships the cover the tags advertise: a real 1200x630 png, small enough for link previews", () => {
    // Vitest runs from web/, so the public dir sits under the cwd.
    const png = readFileSync(join(process.cwd(), "public", "og.png"));
    // PNG signature, then width and height straight from the IHDR chunk, so
    // the asset on disk can never drift from the dimensions the tags declare.
    expect([...png.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.byteLength).toBeLessThan(64 * 1024);
  });
});

// A stray face costs every route: the next/font stylesheet is
// render-blocking.
describe("font declarations", () => {
  const families = ["--font-serif", "--font-sans", "--font-mono"];

  it("declares one self-hosted file per family, the serif upright only", () => {
    expect(Object.keys(fonts.declared).sort()).toEqual([...families].sort());
    expect(fonts.declared["--font-serif"].style).toBeUndefined();
  });

  it("swaps every family, so no face blocks first paint", () => {
    for (const name of families) expect(fonts.declared[name].display).toBe("swap");
  });

  // Each file is a variable font; the declared range must match the file's
  // own weight axis, read from its fvar table, or a weight the pages ask for
  // falls outside the face and the browser fakes it.
  it("declares each file's own weight range, wide enough for every weight the pages use", () => {
    for (const name of families) {
      const { src, weight } = fonts.declared[name];
      const file = readFileSync(join(process.cwd(), "app", src));
      expect(`${weightAxis(file).min} ${weightAxis(file).max}`).toBe(weight);
      const [min, max] = weight!.split(" ").map(Number);
      expect(min).toBeLessThanOrEqual(400);
      expect(max).toBeGreaterThanOrEqual(name === "--font-serif" ? 600 : 700);
    }
  });

  it("ships each font's OFL license beside it", () => {
    for (const name of families) {
      const license = fonts.declared[name].src.replace("-latin.woff2", "-ofl.txt");
      const text = readFileSync(join(process.cwd(), "app", license), "utf8");
      expect(text).toContain("SIL Open Font License, Version 1.1");
    }
  });
});

/** The wght axis of a woff2 file's fvar table, decoded with node's brotli. */
function weightAxis(woff2: Buffer): { min: number; max: number } {
  const TAG_INDEX: Record<number, string> = { 47: "fvar" };
  const at = { i: 48 };
  const base128 = () => {
    let value = 0;
    for (;;) {
      const b = woff2[at.i++];
      value = value * 128 + (b & 0x7f);
      if (!(b & 0x80)) return value;
    }
  };
  const tables: { tag: string; length: number }[] = [];
  for (let t = 0; t < woff2.readUInt16BE(12); t++) {
    const flags = woff2[at.i++];
    let tag = TAG_INDEX[flags & 0x3f] ?? `#${flags & 0x3f}`;
    if ((flags & 0x3f) === 63) {
      tag = woff2.toString("latin1", at.i, at.i + 4);
      at.i += 4;
    }
    const origLength = base128();
    // glyf (10) and loca (11) are transformed at version 0, every other
    // table at any other version; a transformed table stores its new length.
    const glyfOrLoca = (flags & 0x3f) === 10 || (flags & 0x3f) === 11;
    const transformed = glyfOrLoca ? flags >> 6 === 0 : flags >> 6 !== 0;
    tables.push({ tag, length: transformed ? base128() : origLength });
  }
  const data = brotliDecompressSync(woff2.subarray(at.i, at.i + woff2.readUInt32BE(20)));
  let offset = 0;
  for (const { tag, length } of tables) {
    if (tag === "fvar") {
      const fvar = data.subarray(offset, offset + length);
      const first = fvar.readUInt16BE(4);
      for (let a = 0; a < fvar.readUInt16BE(8); a++) {
        const p = first + a * fvar.readUInt16BE(10);
        if (fvar.toString("latin1", p, p + 4) === "wght") {
          return { min: fvar.readInt32BE(p + 4) / 65536, max: fvar.readInt32BE(p + 12) / 65536 };
        }
      }
    }
    offset += length;
  }
  throw new Error("no wght axis");
}
