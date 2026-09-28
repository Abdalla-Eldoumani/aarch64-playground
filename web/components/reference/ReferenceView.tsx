"use client";

/**
 * The reference page's four tabs. The converter loads only when its tab opens,
 * so the page's first download stays small; a #converter, #converter-octal or
 * #converter-ieee754 link opens it at that part.
 */

import { useEffect, useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { AapcsRail } from "@/components/diagrams/AapcsRail";
import { InstructionReference } from "@/components/reference/InstructionReference";
import { CallingConventionGuide } from "@/components/reference/CallingConventionGuide";
import { PitfallsCatalog } from "@/components/reference/PitfallsCatalog";
import type { ConverterView } from "@/components/panels/BaseConverter";
import { useHashFragment } from "@/lib/hooks/use-hash-fragment";
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

// The fragments that open the converter, so a lesson can link straight to
// it: /reference#converter, or a part of it. A Map, not an object, so a
// fragment like #constructor cannot match an inherited key.
const CONVERTER_LINKS = new Map<string, ConverterView | undefined>([
  ["converter", undefined],
  ["converter-octal", "octal"],
  ["converter-ieee754", "ieee754"],
]);

export function ReferenceView({
  instructions,
}: {
  instructions: ReferenceInstruction[];
}): JSX.Element {
  const fragment = useHashFragment();
  // The reader's tab pick; until there is one, the fragment decides.
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked ?? (CONVERTER_LINKS.has(fragment) ? "converter" : "instructions");
  // False until the first tab switch, so the panel entrance answers the
  // reader's pick and never slows the first paint on a slow phone.
  const [switched, setSwitched] = useState(false);

  // A converter link followed on this page (back, forward, a clicked
  // #converter link) wins over an earlier tab pick. Other fragments belong
  // to the instruction list and leave the tab alone.
  useEffect(() => {
    const onHashChange = () => {
      if (CONVERTER_LINKS.has(window.location.hash.replace(/^#/, ""))) setPicked(null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function onChange(value: string) {
    setSwitched(true);
    setPicked(value);
  }

  return (
    <Tabs
      items={TABS}
      active={active}
      onChange={onChange}
      label="reference sections"
    >
      {/* Keyed by the tab so each switch replays the entrance; the sections
          unmount on switch anyway, so the key costs no state. */}
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
              One bit pattern, five readings: hex, octal, binary, unsigned, and
              two&apos;s complement. At 32 and 64 bits the same pattern also reads as
              an IEEE-754 float. Type into any field or flip bits directly; the
              width selector decides which bit is the sign.
            </p>
            <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]">
              {/* Keyed by the fragment so following a second converter link
                  on this page opens that part afresh. */}
              <BaseConverter key={fragment} view={CONVERTER_LINKS.get(fragment)} />
            </div>
          </div>
        )}
      </div>
    </Tabs>
  );
}
