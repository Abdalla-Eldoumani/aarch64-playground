"use client";

import { Suspense, lazy, memo, useEffect, useRef, type JSX } from "react";
import Link from "next/link";
import type { EmbeddablePlaygroundHandle } from "@/components/playground/EmbeddablePlayground";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { Button } from "@/components/ui/Button";
import { referenceHref, type Pitfall } from "@/lib/content/pitfall-data";
import { pitfallFragment } from "@/lib/content/site";

/**
 * One common mistake: its wrong and right snippet, what the course server
 * and the playground do with the broken program, the fix, its links, and
 * buttons that run the whole broken or fixed program in place.
 */

// The emulator surface loads only when a demo is opened; the catalog itself
// stays free of the embed's chunk. React's lazy, not next/dynamic: the demo
// drives the embed through its handle, and next/dynamic does not promise to
// pass a ref on (its pages-router build answers with a handle of its own).
// A demo opens only on a click, so it never renders on the server.
const EmbeddablePlayground = lazy(() =>
  import("@/components/playground/EmbeddablePlayground").then((m) => ({
    default: m.EmbeddablePlayground,
  })),
);

// min-w-0 lets a panel shrink below its longest code line, which then
// scrolls inside its block instead of pushing the page sideways on a phone.
const WRONG_PANEL =
  "flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-card)] border-l-4 border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3";
const RIGHT_PANEL =
  "flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-card)] border-l-4 border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-3";
const LABEL_CLASS =
  "text-[12px] font-semibold uppercase tracking-wide text-[var(--text-primary)]";
const LINK_CLASS =
  "text-[var(--cyan)] underline decoration-[color-mix(in_srgb,var(--cyan)_45%,transparent)] underline-offset-2 hover:decoration-[var(--cyan)] focus-visible:outline-none focus-visible:[box-shadow:var(--ring)]";

export type PitfallVariant = "broken" | "fixed";

const RUN_LABEL: Record<PitfallVariant, string> = {
  broken: "run the broken program",
  fixed: "run the fixed program",
};

// Memoized: the catalog re-renders on every keystroke in its filter, and a
// card's markdown and highlighted code need not render again unless the card
// itself changed.
export const PitfallCard = memo(function PitfallCard({
  pitfall,
  lessonTitle,
  running,
  onRun,
}: {
  pitfall: Pitfall;
  lessonTitle: string;
  /** The program running under this card, if any. */
  running: PitfallVariant | null;
  /** Opens that program under this card, or closes it when it is running. */
  onRun: (slug: string, variant: PitfallVariant) => void;
}): JSX.Element {
  const id = pitfallFragment(pitfall.slug);

  function runButton(variant: PitfallVariant) {
    const on = running === variant;
    return (
      <Button
        variant="secondary"
        aria-label={on ? `close the demo: ${pitfall.title}` : `${RUN_LABEL[variant]}: ${pitfall.title}`}
        aria-pressed={on}
        onClick={() => onRun(pitfall.slug, variant)}
        className="touch-target self-start"
      >
        {on ? "close" : RUN_LABEL[variant]}
      </Button>
    );
  }

  return (
    <article id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-3">
      <h3 id={`${id}-title`} className="text-[var(--text-primary)] [font:var(--type-h3)]">
        {pitfall.title}
      </h3>
      <LessonMarkdown markdown={pitfall.mistake} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={WRONG_PANEL}>
          <p className={LABEL_CLASS}>wrong</p>
          <CodeBlock code={pitfall.wrong} />
          {runButton("broken")}
        </div>
        <div className={RIGHT_PANEL}>
          <p className={LABEL_CLASS}>right</p>
          <CodeBlock code={pitfall.right} />
          {runButton("fixed")}
        </div>
      </div>
      {/* The markdown's paragraph margins are dropped here so each answer
          sits on the baseline of its label. */}
      <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline [&_p]:my-0">
        <dt className={LABEL_CLASS}>on the server</dt>
        <dd>
          <LessonMarkdown markdown={`The broken program ${pitfall.server}`} />
        </dd>
        <dt className={LABEL_CLASS}>in the playground</dt>
        <dd>
          <LessonMarkdown markdown={`It ${pitfall.playground}`} />
        </dd>
        <dt className={LABEL_CLASS}>the fix</dt>
        <dd>
          <LessonMarkdown markdown={pitfall.fix} />
        </dd>
      </dl>
      <ul className="flex flex-col gap-1 text-[var(--text-secondary)] [font:var(--type-small)] sm:flex-row sm:flex-wrap sm:gap-x-6">
        <li>
          Lesson:{" "}
          <Link href={`/learn/${pitfall.lesson}`} className={LINK_CLASS}>
            {lessonTitle}
          </Link>
        </li>
        <li>
          Reference:{" "}
          <a href={referenceHref(pitfall.reference)} className={LINK_CLASS}>
            {pitfall.reference}
          </a>
        </li>
        <li>
          Source:{" "}
          <a href={pitfall.source.href} rel="noreferrer noopener" className={LINK_CLASS}>
            {pitfall.source.title}
          </a>
        </li>
      </ul>
      {running && (
        // The key remounts the demo when the variant switches, which resets
        // the machine for the other program.
        <PitfallDemo key={`${pitfall.slug}-${running}`} source={pitfall[running].source} />
      )}
    </article>
  );
});

/**
 * The open demo. The button that opened it said run, so the program assembles
 * and runs as soon as the machine loads (the broken one shows its error), and
 * the frame comes into view with its controls.
 */
function PitfallDemo({ source }: { source: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Instant whatever the motion setting: a smooth scroll moves the whole page.
  useEffect(() => {
    frameRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);

  return (
    // Fixed frame so the editor loading never shifts the page.
    <div
      ref={frameRef}
      className="embed-frame flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[560px]"
    >
      <Suspense fallback={null}>
        <EmbeddablePlayground
          // Called again on every render with a fresh function; the run is once.
          ref={(handle: EmbeddablePlaygroundHandle | null) => {
            if (!handle || started.current) return;
            started.current = true;
            handle.assembleAndRun();
          }}
          chrome="embed"
          startSource={source}
          readOnly={false}
          registerHeadingLevel={4}
        />
      </Suspense>
    </div>
  );
}
