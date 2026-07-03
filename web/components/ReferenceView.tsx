"use client";

/**
 * The reference surface shell: four sections behind the shared Tabs primitive
 * (the WAI-ARIA tablist with roving tabindex and arrow-key nav). Instructions is
 * the default and renders the two-pane reference fed the instruction array;
 * Calling convention renders the aapcs64 guide; Pitfalls renders the catalog;
 * Converter mounts the shared base converter (loaded on demand so the route
 * chunk stays free of it) for checking an encoding without leaving the page.
 * It owns only the active-tab state and switches which section fills the single
 * tabpanel, so each section keeps its own inner measure and the tab strip is the
 * one source of the active-route accent. Token-only and reduced-motion safe.
 */

import { useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { Tabs, type TabItem } from "@/components/Tabs";
import { InstructionReference } from "@/components/InstructionReference";
import { CallingConventionGuide } from "@/components/CallingConventionGuide";
import { PitfallsCatalog } from "@/components/PitfallsCatalog";
import type { ReferenceInstruction } from "@/lib/reference-data";

const BaseConverter = dynamic(
  () => import("@/components/BaseConverter").then((m) => m.BaseConverter),
  { ssr: false },
);

const TABS: TabItem[] = [
  { value: "instructions", label: "Instructions" },
  { value: "calling-convention", label: "Calling convention" },
  { value: "pitfalls", label: "Pitfalls" },
  { value: "converter", label: "Converter" },
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
        {active === "converter" && (
          <div className="max-w-2xl">
            <p className="text-[var(--text-secondary)] [font:var(--type-body)]">
              One bit pattern, four readings: hex, binary, unsigned, and two&apos;s
              complement. Type into any field or flip bits directly; the width
              selector decides which bit is the sign.
            </p>
            <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]">
              <BaseConverter />
            </div>
          </div>
        )}
      </div>
    </Tabs>
  );
}
