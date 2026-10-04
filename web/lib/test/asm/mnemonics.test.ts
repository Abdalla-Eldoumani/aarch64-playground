// lib/asm/mnemonics keeps the names without the hover-card text so the landing
// page never loads that table. The split is safe only while the two lists
// agree, so this checks them in both directions.

import { describe, expect, it } from "vitest";
import { ARM64_MNEMONIC_NAMES } from "@/lib/asm/mnemonics";
import { INSTRUCTION_DOCS, lookupDoc } from "@/lib/asm/instruction-docs";

/** The hover-card keys, lowercase, without the conditional-branch placeholder
 *  that stands for a family rather than a spelling. */
const documented = Object.keys(INSTRUCTION_DOCS)
  .filter((m) => m !== "B.COND")
  .map((m) => m.toLowerCase());

describe("ARM64_MNEMONIC_NAMES", () => {
  it("is exactly the hover-card table minus the B.COND placeholder", () => {
    const namesOnly = [...ARM64_MNEMONIC_NAMES].sort();
    const cards = [...documented].sort();
    // Report both directions so a drift names the mnemonic, not just a count.
    expect({
      inNamesOnly: namesOnly.filter((m) => !cards.includes(m)),
      inCardsOnly: cards.filter((m) => !namesOnly.includes(m)),
    }).toEqual({ inNamesOnly: [], inCardsOnly: [] });
    expect(namesOnly).toEqual(cards);
  });

  it("holds no duplicates and no placeholder", () => {
    expect(ARM64_MNEMONIC_NAMES.length).toBe(new Set(ARM64_MNEMONIC_NAMES).size);
    expect(ARM64_MNEMONIC_NAMES).not.toContain("b.cond");
  });

  it("is all lowercase, the case the highlighter and typo suggestions compare in", () => {
    const shouted = ARM64_MNEMONIC_NAMES.filter((m) => m !== m.toLowerCase());
    expect(shouted).toEqual([]);
  });

  it("resolves every name through lookupDoc", () => {
    const missing = ARM64_MNEMONIC_NAMES.filter(
      (m) => lookupDoc(m) === undefined,
    );
    expect(missing).toEqual([]);
  });
});
