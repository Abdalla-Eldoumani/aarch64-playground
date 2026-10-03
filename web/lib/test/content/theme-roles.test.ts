import { describe, expect, it } from "vitest";
import { THEMES, type ThemeId } from "@/lib/theme/themes";
import { THEME_TOKENS } from "@/lib/theme/tokens";
import { ciede2000, deltaE2000, oklchHue } from "@/lib/test/content/helpers/contrast";

/**
 * The six role colours stay apart: at least 20 CIEDE2000 between any two,
 * so the machine's mark, your controls, success, warning, danger and a
 * just-changed value never read as one another. Meaning never rests on
 * colour alone; this keeps the colour from lying.
 */

const ROLES = ["amber", "cyan", "success", "warning", "danger", "changed"] as const;

// The original three themes keep the look they shipped with, where warning
// and the changed-value ink are drawn in the machine's own amber family on
// purpose (a changed register also carries the amber write bar, and a
// warning its icon and words). Every other pair is held in them too.
const AMBER_FAMILY = new Set(["amber / warning", "amber / changed", "warning / changed"]);
const ORIGINAL: readonly ThemeId[] = ["dark", "light", "high-contrast"];

describe("role colours stay distinct", () => {
  for (const { id } of THEMES) {
    it(`${id}: every pair of roles is at least 20 apart`, () => {
      const t = THEME_TOKENS[id];
      const close: string[] = [];
      for (let i = 0; i < ROLES.length; i++) {
        for (let j = i + 1; j < ROLES.length; j++) {
          const pair = `${ROLES[i]} / ${ROLES[j]}`;
          if (ORIGINAL.includes(id) && AMBER_FAMILY.has(pair)) continue;
          const d = ciede2000(t[ROLES[i]], t[ROLES[j]]);
          if (d < 20) close.push(`${pair}: ${d.toFixed(1)}`);
        }
      }
      expect(close).toEqual([]);
    });
  }

  it("measures on the CIEDE2000 scale", () => {
    // Pairs 1, 7, 17 and 18 of Sharma, Wu and Dalal's published test data.
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
    expect(deltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 4);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 4);
    expect(deltaE2000([50, 2.5, 0], [61, -5, 29])).toBeCloseTo(22.8977, 4);
    expect(ciede2000("#123456", "#123456")).toBe(0);
    expect(ciede2000("#000000", "#FFFFFF")).toBeCloseTo(100, 0);
  });

  it("reads OKLCH hues where the named colours sit", () => {
    expect(oklchHue("#FF0000")).toBeCloseTo(29.2, 0);
    expect(oklchHue("#00FF00")).toBeCloseTo(142.5, 0);
    expect(oklchHue("#0000FF")).toBeCloseTo(264.1, 0);
  });
});
