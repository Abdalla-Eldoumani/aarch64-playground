"use client";

import { useState, type JSX } from "react";
import dynamic from "next/dynamic";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { Button } from "@/components/ui/Button";
import { PITFALLS } from "@/lib/content/pitfall-data";

/**
 * The seven recurring CPSC 355 traps. Each card keeps the compact wrong/right
 * snippets (read-only CodeBlock, token accents, never color alone) and gains
 * the run-it-live affordance: "run the fault" seeds the complete faulty
 * program into the one shared EmbeddablePlayground and the student watches it
 * actually misbehave -- a printed misalignment, a ret that chases its own
 * tail, a wild-address fault, a wrong sum -- then "run the fix" swaps in the
 * corrected program. All content comes from lib/pitfall-data (scanned by the
 * course-style guard, behavior pinned on the emulator by its playground
 * test). One embed exists at a time, mounted on demand and dynamically
 * imported, so browsing the catalog stays light and opening a demo never
 * spins up five workers. The fixed-height frame mounts only with the embed,
 * so a closed card costs no space and an open one never shifts layout.
 * Token-only and reduced-motion safe (discrete state, no animation).
 */

// The emulator surface loads only when a demo is opened; the catalog page
// itself stays free of the embed's chunk.
const EmbeddablePlayground = dynamic(
  () =>
    import("@/components/playground/EmbeddablePlayground").then(
      (m) => m.EmbeddablePlayground,
    ),
  { ssr: false, loading: () => null },
);

const WRONG_PANEL =
  "flex flex-col gap-1.5 rounded-[var(--radius-card)] border-l-4 border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3";
const RIGHT_PANEL =
  "flex flex-col gap-1.5 rounded-[var(--radius-card)] border-l-4 border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-3";
const LABEL_CLASS =
  "text-[12px] font-semibold uppercase tracking-wide text-[var(--text-primary)]";

type Variant = "fault" | "fix";

interface OpenDemo {
  index: number;
  variant: Variant;
}

export function PitfallsCatalog({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState<OpenDemo | null>(null);

  function toggle(index: number, variant: Variant) {
    setOpen((current) =>
      current && current.index === index && current.variant === variant
        ? null
        : { index, variant },
    );
  }

  return (
    <section
      aria-label="cpsc 355 pitfalls"
      className={`mx-auto flex max-w-3xl flex-col gap-8 ${className}`}
    >
      {PITFALLS.map((pitfall, index) => {
        const openHere = open?.index === index ? open : null;
        return (
          <article key={pitfall.title} className="flex flex-col gap-3">
            <h3 className="text-[19px] font-semibold text-[var(--text-primary)]">
              {pitfall.title}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={WRONG_PANEL}>
                <p className={LABEL_CLASS}>wrong</p>
                <CodeBlock code={pitfall.wrong} />
                <Button
                  variant="secondary"
                  aria-label={
                    openHere?.variant === "fault"
                      ? `close the demo: ${pitfall.title}`
                      : `run the fault: ${pitfall.title}`
                  }
                  aria-pressed={openHere?.variant === "fault"}
                  onClick={() => toggle(index, "fault")}
                  className="self-start"
                >
                  {openHere?.variant === "fault" ? "close" : "run the fault"}
                </Button>
              </div>
              <div className={RIGHT_PANEL}>
                <p className={LABEL_CLASS}>right</p>
                <CodeBlock code={pitfall.right} />
                <Button
                  variant="secondary"
                  aria-label={
                    openHere?.variant === "fix"
                      ? `close the demo: ${pitfall.title}`
                      : `run the fix: ${pitfall.title}`
                  }
                  aria-pressed={openHere?.variant === "fix"}
                  onClick={() => toggle(index, "fix")}
                  className="self-start"
                >
                  {openHere?.variant === "fix" ? "close" : "run the fix"}
                </Button>
              </div>
            </div>
            <LessonMarkdown
              markdown={pitfall.cause}
              className="text-[var(--text-secondary)]"
            />
            {openHere && (
              <div className="flex flex-col gap-2">
                <p className="border-l-2 border-[var(--amber)] pl-3 [font:var(--type-small)] text-[var(--text-secondary)]">
                  {pitfall.watch}
                </p>
                {/* Fixed frame so the editor loading never shifts the page;
                    key remounts the embed when the variant switches, which
                    resets the machine for the other program. */}
                <div className="flex h-[560px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]">
                  <EmbeddablePlayground
                    key={`${index}-${openHere.variant}`}
                    chrome="embed"
                    startSource={
                      openHere.variant === "fault" ? pitfall.fault : pitfall.fix
                    }
                    readOnly={false}
                  />
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
