"use client";

import { useEffect, useMemo, useState } from "react";
import { callCard, spokenCard } from "@/lib/emulator/call-cards";
import type { EmulatorState } from "@/lib/emulator/emulator-state";
import { frameBoxes } from "@/lib/emulator/frame-boxes";

export type CallCardProps = Pick<
  EmulatorState,
  "callCard" | "frames" | "frameLayout" | "registers" | "sp" | "pc" | "memoryRegions" | "lineLabel" | "isRunning"
>;

// The calls said, per program load, outside any one card, so a console
// mounted again (a phone's pane switch) or Back onto the call says none of
// them twice. Every assemble hands over a new layout object, so a reset or
// an edit starts a new set.
const saidPerLoad = new WeakMap<object, Set<string>>();

/**
 * What the printf or scanf call the last step ran did, under the console's
 * output: the format as written, then each conversion with its register,
 * its value, and what it printed or where it stored. The external-call
 * card's look, since it is the same call, now returned. Said once, politely.
 */
export function CallCard({ callCard: numbers, frames, frameLayout, registers, sp, pc, memoryRegions, lineLabel, isRunning }: CallCardProps) {
  const card = useMemo(() => {
    if (!numbers || isRunning) return null;
    const stack = frameBoxes(frames, frameLayout, registers, sp, pc);
    return callCard(numbers, { stack, regions: memoryRegions, lineLabel });
  }, [numbers, isRunning, frames, frameLayout, registers, sp, pc, memoryRegions, lineLabel]);

  const [mountKey] = useState(() => ({}));
  const loadKey = frameLayout ?? mountKey;
  const unsaid = card && !saidPerLoad.get(loadKey)?.has(card.event) ? card : null;
  const [said, setSaid] = useState({ event: "", text: "", count: 0 });
  if (unsaid && unsaid.event !== said.event) {
    setSaid({ event: unsaid.event, text: spokenCard(unsaid), count: said.count + 1 });
  }
  useEffect(() => {
    if (!unsaid) return;
    let heard = saidPerLoad.get(loadKey);
    if (!heard) saidPerLoad.set(loadKey, (heard = new Set()));
    heard.add(unsaid.event);
  });

  return (
    <>
      {card && (
        <div
          role="group"
          aria-label={`what ${card.name} did`}
          className="mt-1 flex flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--amber)] px-2 py-1.5 font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-words"
          style={{ backgroundColor: "color-mix(in srgb, var(--amber) 8%, transparent)" }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[13px] font-medium text-[var(--amber)]">{card.title}</span>
            {card.line && <span className="text-[var(--text-secondary)]">{card.line}</span>}
          </div>
          {card.rows.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-[var(--text-primary)]">
              {card.rows.map((row, i) => (
                <li key={i}>
                  {row.text}
                  {row.problem && <span className="block font-sans text-[var(--warning)]">{row.problem}</span>}
                </li>
              ))}
            </ul>
          )}
          <span className="text-[var(--text-secondary)]">{card.outcome}</span>
        </div>
      )}
      {/* The space on every other card makes the same words in a loop's
          next call a change the screen reader says again. */}
      <p role="status" className="sr-only">
        {said.text}
        {said.count % 2 ? " " : ""}
      </p>
    </>
  );
}
