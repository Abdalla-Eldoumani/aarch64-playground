"use client";

import { memo, type JSX } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
// stays free of the embed's chunk.
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
      <LessonMarkdown markdown={pitfall.mistake} className="text-[var(--text-secondary)]" />
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
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className={LABEL_CLASS}>on the server</dt>
        <dd>
          <LessonMarkdown
            markdown={`The broken program ${pitfall.server}`}
            className="text-[var(--text-secondary)]"
          />
        </dd>
        <dt className={LABEL_CLASS}>in the playground</dt>
        <dd>
          <LessonMarkdown markdown={`It ${pitfall.playground}`} className="text-[var(--text-secondary)]" />
        </dd>
        <dt className={LABEL_CLASS}>the fix</dt>
        <dd>
          <LessonMarkdown markdown={pitfall.fix} className="text-[var(--text-secondary)]" />
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
        // Fixed frame so the editor loading never shifts the page; the key
        // remounts the embed when the variant switches, which resets the
        // machine for the other program.
        <div className="embed-frame flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[560px]">
          <EmbeddablePlayground
            key={`${pitfall.slug}-${running}`}
            chrome="embed"
            startSource={pitfall[running].source}
            readOnly={false}
            registerHeadingLevel={4}
          />
        </div>
      )}
    </article>
  );
});
