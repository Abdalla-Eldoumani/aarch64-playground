"use client";

/**
 * The reference surface shell: four sections behind the shared Tabs primitive
 * (the WAI-ARIA tablist with roving tabindex and arrow-key nav). Instructions is
 * the default and renders the two-pane reference fed the instruction array with
 * the static AAPCS64 register-file rail as its third column on xl screens (the
 * rail drops below the detail on anything narrower);
 * Calling convention renders the aapcs64 guide; Pitfalls renders the catalog;
 * Converter mounts the shared base converter (loaded on demand so the route
 * chunk stays free of it) for checking an encoding without leaving the page.
 * It owns only the active-tab state and switches which section fills the single
 * tabpanel, so each section keeps its own inner measure and the tab strip is the
 * one source of the active-route accent. Token-only and reduced-motion safe.
 */

import { useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { AapcsRail } from "@/components/diagrams/AapcsRail";
import { InstructionReference } from "@/components/reference/InstructionReference";
import { CallingConventionGuide } from "@/components/reference/CallingConventionGuide";
import { PitfallsCatalog } from "@/components/reference/PitfallsCatalog";
import type { ReferenceInstruction } from "@/lib/content/reference-data";

const BaseConverter = dynamic(
  () => import("@/components/panels/BaseConverter").then((m) => m.BaseConverter),
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
  // The panel entrance answers a tab switch, never the page load: entrance
  // motion is a response to the reader's action, and an animation riding the
  // first paint would also slow it on throttled phones. False until the
  // first switch, so the initial render is plain.
  const [switched, setSwitched] = useState(false);

  function onChange(value: string) {
    setSwitched(true);
    setActive(value);
  }

  return (
    <Tabs
      items={TABS}
      active={active}
      onChange={onChange}
      label="reference sections"
    >
      {/* Keyed by the active tab so a section swap replays the small panel
          entrance (one UI beat, 4px settle). The sections already unmount on
          switch, so the key changes nothing about state, only the animation;
          under prefers-reduced-motion the panel appears in place, static. */}
      <div key={active} className={`${switched ? "anim-panel-in " : ""}mt-8`}>
        {active === "instructions" && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-11 xl:grid-cols-[minmax(0,1fr)_280px]">
            <InstructionReference instructions={instructions} />
            <AapcsRail />
          </div>
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
