"use client";

/**
 * The reference surface shell: three sections behind the shared Tabs primitive
 * (the WAI-ARIA tablist with roving tabindex and arrow-key nav). Instructions is
 * the default and renders the two-pane reference fed the instruction array;
 * Calling convention renders the aapcs64 guide; Pitfalls renders the catalog.
 * It owns only the active-tab state and switches which section fills the single
 * tabpanel, so each section keeps its own inner measure and the tab strip is the
 * one source of the active-route accent. Token-only and reduced-motion safe.
 */

import { useState, type JSX } from "react";
import { Tabs, type TabItem } from "@/components/Tabs";
import { InstructionReference } from "@/components/InstructionReference";
import { CallingConventionGuide } from "@/components/CallingConventionGuide";
import { PitfallsCatalog } from "@/components/PitfallsCatalog";
import type { ReferenceInstruction } from "@/lib/reference-data";

const TABS: TabItem[] = [
  { value: "instructions", label: "Instructions" },
  { value: "calling-convention", label: "Calling convention" },
  { value: "pitfalls", label: "Pitfalls" },
];

export function ReferenceView({
  instructions,
}: {
  instructions: ReferenceInstruction[];
}): JSX.Element {
  const [active, setActive] = useState("instructions");

  return (
    <Tabs
      items={TABS}
      active={active}
      onChange={setActive}
      label="reference sections"
    >
      <div className="mt-8">
        {active === "instructions" && (
          <InstructionReference instructions={instructions} />
        )}
        {active === "calling-convention" && <CallingConventionGuide />}
        {active === "pitfalls" && <PitfallsCatalog />}
      </div>
    </Tabs>
  );
}
