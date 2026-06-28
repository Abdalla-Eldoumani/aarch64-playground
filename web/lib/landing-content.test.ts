import { describe, expect, it } from "vitest";
import { FEATURES, ROUTE_REGISTERS, HERO_PROGRAM } from "./landing-content";
import { NAV_ROUTES } from "@/lib/site";

describe("landing data", () => {
  it("FEATURES is a non-empty catalog with a title and description per entry", () => {
    // Data-driven contract: adding a capability is one entry, so the shape is
    // what matters - every entry must carry renderable title + description text.
    expect(FEATURES.length).toBeGreaterThanOrEqual(3);
    for (const feature of FEATURES) {
      expect(feature.title.trim().length).toBeGreaterThan(0);
      expect(feature.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("ROUTE_REGISTERS is four rows with the playground primary, reusing NAV_ROUTES", () => {
    expect(ROUTE_REGISTERS).toHaveLength(4);

    const primary = ROUTE_REGISTERS.filter((row) => row.primary);
    expect(primary).toHaveLength(1);
    expect(primary[0].href).toBe("/playground");

    // The non-primary rows reuse the Learn / Practice / Reference hrefs straight
    // from NAV_ROUTES so the addresses can never drift from the canonical source.
    const expectedSecondary = NAV_ROUTES.filter(
      (route) => route.href !== "/playground",
    ).map((route) => route.href);
    const nonPrimary = ROUTE_REGISTERS.filter((row) => !row.primary).map(
      (row) => row.href,
    );
    expect(nonPrimary).toEqual(expectedSecondary);
  });

  it("HERO_PROGRAM is an original, no-I/O, lowercase cpsc 355-style snippet", () => {
    // Structural authenticity (the full visual/step check is the orchestrator's
    // on the deployed hero): in-repo convention markers must be present.
    expect(HERO_PROGRAM).toContain("define(");
    expect(HERO_PROGRAM).toContain("main:");
    expect(HERO_PROGRAM).toContain(".global");
    expect(HERO_PROGRAM).toMatch(/stp\s+x29,\s*x30,\s*\[sp,\s*-16\]!/);
    expect(HERO_PROGRAM).toMatch(/ldp\s+x29,\s*x30,\s*\[sp\],\s*16/);
    expect(HERO_PROGRAM).toMatch(/ldp[\s\S]*\bret\b/);

    // No hosted I/O, so stepping is fast and purely visual.
    expect(HERO_PROGRAM).not.toMatch(/printf|scanf|svc|\bbl /);

    // Lowercase mnemonics only: no line begins with an uppercase instruction.
    expect(HERO_PROGRAM).not.toMatch(/^\s*[A-Z]{2,}/m);

    // Decimal immediates only: no #0x hex literals.
    expect(HERO_PROGRAM).not.toMatch(/#0x/i);
  });
});
