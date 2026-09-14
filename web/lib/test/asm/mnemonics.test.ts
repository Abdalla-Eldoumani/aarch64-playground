// The drift guard for the name-only mnemonic list.
//
// lib/asm/mnemonics carries the names without the prose so the landing bundle
// never pulls the hover-card table in behind the highlighter. That split is
// only safe while the two agree, so this pins them in both directions, the way
// reference-data and instruction-docs are pinned to each other and both are
// pinned to the assembler's own SUPPORTED_MNEMONICS.

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

  it("is lowercase throughout, the way every surface compares", () => {
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
