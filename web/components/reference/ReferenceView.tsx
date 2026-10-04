"use client";

/**
 * The reference page's five tabs. Every tab but the instructions loads only
 * when it opens, so the page's first download stays small. A link can open a
 * tab: #calling-convention or #calling-convention-<section> (at that
 * section), #pitfalls or #pitfall-<slug> (at that card),
 * #directives-and-debugger, and #converter, #converter-octal or
 * #converter-ieee754 (at that part).
 */

import { useEffect, useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { AapcsRail } from "@/components/diagrams/AapcsRail";
import { InstructionReference } from "@/components/reference/InstructionReference";
import type { ConverterView } from "@/components/panels/BaseConverter";
import { useHashFragment } from "@/lib/hooks/use-hash-fragment";
import { callingConventionFragment, pitfallFragment, referenceId } from "@/lib/content/site";
import type { ReferenceInstruction } from "@/lib/content/reference-data";

const BaseConverter = dynamic(
  () => import("@/components/panels/BaseConverter").then((m) => m.BaseConverter),
  { ssr: false },
);
// The cards carry two whole programs each, and the guide seven, so both stay
// out of the route chunk.
const CallingConventionGuide = dynamic(
  () =>
    import("@/components/reference/CallingConventionGuide").then(
      (m) => m.CallingConventionGuide,
    ),
  { ssr: false },
);
const PitfallsCatalog = dynamic(
  () => import("@/components/reference/PitfallsCatalog").then((m) => m.PitfallsCatalog),
  { ssr: false },
);
// Its tables are text the first view never shows, so they stay out of the route chunk.
const DirectivesAndDebugger = dynamic(
  () => import("@/components/reference/DirectivesAndDebugger").then((m) => m.DirectivesAndDebugger),
  { ssr: false },
);

const TABS: TabItem[] = [
  { value: "instructions", label: "Instructions" },
  { value: "calling-convention", label: "Calling convention" },
  { value: "pitfalls", label: "Pitfalls" },
  { value: "converter", label: "Converter" },
  { value: "directives-and-debugger", label: "Directives and debugger" },
];

// The fragments that open the converter, so a lesson can link straight to
// it: /reference#converter, or a part of it. A Map, not an object, so a
// fragment like #constructor cannot match an inherited key.
const CONVERTER_LINKS = new Map<string, ConverterView | undefined>([
  ["converter", undefined],
  ["converter-octal", "octal"],
  ["converter-ieee754", "ieee754"],
]);

/** The tab a fragment opens, or null for one that names no tab. */
function tabFor(fragment: string): string | null {
  if (CONVERTER_LINKS.has(fragment)) return "converter";
  if (fragment === "pitfalls" || fragment.startsWith(pitfallFragment(""))) return "pitfalls";
  if (fragment === "calling-convention" || fragment.startsWith(callingConventionFragment(""))) {
    return "calling-convention";
  }
  if (fragment === "directives-and-debugger") return "directives-and-debugger";
  return null;
}

export function ReferenceView({
  instructions,
  course,
  lessonTitles,
}: {
  instructions: ReferenceInstruction[];
  /** The mnemonics the course's programs use, for the instruction finder. */
  course?: readonly string[];
  /** Lesson titles by slug, for the pitfall cards' lesson links. */
  lessonTitles: Record<string, string>;
}): JSX.Element {
  const fragment = useHashFragment();
  // The reader's tab pick; until there is one, the fragment decides.
  const [picked, setPicked] = useState<string | null>(null);
  const active = picked ?? tabFor(fragment) ?? "instructions";
  // False until the first tab switch, so the panel entrance answers the
  // reader's pick and never slows the first paint on a slow phone.
  const [switched, setSwitched] = useState(false);

  // A link followed on this page (back, forward, a clicked #link) wins over
  // an earlier tab pick when it names a tab or an instruction, so a pitfall
  // card's #cmp link lands on cmp. Any other fragment, such as the skip
  // link's #main, leaves the tab alone.
  useEffect(() => {
    const onHashChange = () => {
      const followed = window.location.hash.replace(/^#/, "");
      if (tabFor(followed) || instructions.some((i) => referenceId(i.mnemonic) === followed)) {
        setPicked(null);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [instructions]);

  function onChange(value: string) {
    // A press on the open tab changes nothing, and keeps the fragment that
    // selected the instruction on show.
    if (value === active) return;
    setSwitched(true);
    setPicked(value);
    // The pick replaces whatever the fragment opened, so the fragment goes:
    // a reload shows the picked tab, and a later link to that same fragment
    // still changes the URL, so it still fires hashchange and still lands.
    // replaceState fires no hashchange, so one is sent for the fragment store.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
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
            <InstructionReference instructions={instructions} course={course} />
            <AapcsRail />
          </div>
        )}
        {active === "calling-convention" && <CallingConventionGuide />}
        {active === "pitfalls" && <PitfallsCatalog lessonTitles={lessonTitles} />}
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
        {active === "directives-and-debugger" && <DirectivesAndDebugger />}
      </div>
    </Tabs>
  );
}
