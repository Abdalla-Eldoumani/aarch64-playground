"use client";

import { useRef, useState } from "react";
import {
  EmbeddablePlayground,
  type EmbeddablePlaygroundHandle,
} from "@/components/playground/EmbeddablePlayground";
import type { WalkCommand, WalkState } from "@/lib/playground/use-autoplay";
import { HERO_PROGRAM } from "@/lib/content/landing-content";

// What the title bar's control says, and asks the walk for, in each state.
// The accessible name keeps the visible word first, so a voice command that
// reads the button still reaches it.
const CONTROL: Record<WalkState, { label: string; name: string; command: WalkCommand }> = {
  playing: { label: "pause", name: "pause the demo", command: "pause" },
  paused: { label: "play", name: "play the demo", command: "resume" },
  done: { label: "replay", name: "replay the demo", command: "replay" },
  stepping: { label: "step through it", name: "step through it", command: "step" },
};

const CONTROL_CLASS =
  "touch-target min-h-[28px] items-center whitespace-nowrap border border-[var(--border-strong)] px-2.5 " +
  "font-mono text-[12px] font-medium text-[var(--cyan)] transition-colors " +
  "hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:[box-shadow:var(--ring)]";

// The control is two buttons, one per motion setting, both mounted for the
// page's life: a reader can tab to it before the walk reports, and swapping
// the button then would drop their focus. Until the report, CSS paints the
// one that matches the reader's setting.
const SLOTS = [
  { key: "motion", reduced: false, first: "playing", firstPaint: "inline-flex motion-reduce:hidden" },
  { key: "reduced", reduced: true, first: "stepping", firstPaint: "hidden motion-reduce:inline-flex" },
] as const;

/**
 * The hero's live demo: the embeddable playground walking the hero program,
 * framed as an instrument with its own pause and replay control.
 */
export function HeroDemo() {
  const demo = useRef<EmbeddablePlaygroundHandle>(null);
  // Null until the walk reports, which is after hydration.
  const [walk, setWalk] = useState<{ state: WalkState; reduced: boolean } | null>(null);
  const onWalk = (state: WalkState) =>
    setWalk((last) => ({
      state,
      // Read once, at the first report: the query the CSS answered until
      // then, so the button that stays is the one the reader could reach.
      reduced: last?.reduced ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));

  return (
    <div className="relative px-0 sm:px-2.5">
      <span
        aria-hidden="true"
        className="absolute bottom-6 left-0 top-6 hidden w-2.5 sm:block"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--border-strong) 0 8px, transparent 8px 24px)",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-6 right-0 top-6 hidden w-2.5 sm:block"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--border-strong) 0 8px, transparent 8px 24px)",
        }}
      />
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-sunken)] [box-shadow:var(--shadow-frame)]">
        {/* Wraps under 300px, where "step through it" ran past the frame. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 sm:gap-x-3 sm:px-4">
          <span aria-hidden="true" className="inline-flex h-[12px]">
            {[10, 5, 5, 5].map((width, index) => (
              <span
                key={index}
                className={`inline-block border-y border-r border-[var(--border-strong)] ${
                  index === 0 ? "border-l" : ""
                } ${index === 2 ? "bg-[var(--amber)]" : ""}`}
                style={{ width, height: 12 }}
              />
            ))}
          </span>
          <span className="whitespace-nowrap font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            live demo
          </span>
          {/* Sits after the name, not at the far end, so a label that grows
              from "pause" to "step through it" moves nothing beside it. */}
          {SLOTS.map((slot) => {
            const state = walk?.state ?? slot.first;
            const unused = walk !== null && walk.reduced !== slot.reduced;
            return (
              <button
                key={slot.key}
                type="button"
                hidden={unused}
                aria-label={CONTROL[state].name}
                onClick={() => demo.current?.walk(CONTROL[state].command)}
                // No display class on the unused button: one would beat the
                // hidden attribute.
                className={`${CONTROL_CLASS} ${
                  walk === null ? slot.firstPaint : unused ? "" : "inline-flex"
                }`}
              >
                {CONTROL[state].label}
              </button>
            );
          })}
          <span className="ml-auto hidden font-mono text-[12px] text-[var(--text-tertiary)] sm:inline">
            <span className="motion-reduce:hidden">one instruction every 450 ms</span>
            <span className="hidden motion-reduce:inline">one instruction per press</span>
          </span>
        </div>
        {/* One fixed embed height at every breakpoint, so the page cannot
            shift as the emulator loads; the embed arranges itself to fit. */}
        <div className="flex h-[560px] flex-col">
          <EmbeddablePlayground
            ref={demo}
            chrome="embed"
            startSource={HERO_PROGRAM}
            autoplay
            // The walk reaches the program's svc on step 9, so the hero prints
            // its line into the embed console during the autoplay.
            autoplaySteps={10}
            onAutoplayChange={onWalk}
            readOnly
            // A demonstration needs no editing surface, so the hero draws
            // its program with the static view: the code is in the server
            // HTML and the landing never loads the editor at all.
            staticEditor
            // The walk has its own control in the title bar, so the frame
            // keeps run and reset and leaves out step and back.
            showStep={false}
            showBack={false}
          />
        </div>
      </div>
    </div>
  );
}
