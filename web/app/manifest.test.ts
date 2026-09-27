// Pins what a home-screen install shows and how it opens: the site's own
// name under the icon, a standalone window on the playground, and a maskable
// icon for launchers that crop to a shape.
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("web manifest", () => {
  it("names the install AArch64 Playground and opens it standalone on the playground", () => {
    const m = manifest();
    expect(m.name).toBe("AArch64 Playground");
    expect(m.short_name).toBe("AArch64");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/playground");
  });

  it("carries any-purpose icons and a separate maskable one", () => {
    const icons = manifest().icons ?? [];
    expect(icons.filter((i) => i.purpose === "any").map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
