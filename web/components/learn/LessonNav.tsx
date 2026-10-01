/**
 * The foot of a lesson: the exercises the lesson links to, then buttons to
 * the previous and next lessons. It holds no state, so the lesson page
 * renders it on the server and it adds no script to the page.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { NeighbourLink, PracticeGroup } from "@/lib/content/lesson-links";

const CAPTION_CLASS =
  "font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]";
const TITLE_CLASS =
  "font-sans text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--cyan)]";
const PRACTICE_ROW_CLASS =
  "group flex min-h-[52px] flex-col justify-center gap-0.5 px-4 py-3 outline-none hover:bg-[var(--bg-raised)] focus-visible:[box-shadow:var(--ring)]";
const BUTTON_CLASS =
  "group flex min-h-[72px] flex-col justify-center gap-1 rounded-[var(--radius-action)] border border-[var(--border-strong)] px-4 py-3 outline-none hover:border-[var(--cyan)] focus-visible:[box-shadow:var(--ring)]";

function NeighbourButton({
  link,
  direction,
}: {
  link: NeighbourLink;
  direction: "previous" | "next";
}): JSX.Element {
  const isNext = direction === "next";
  // Next keeps the right-hand column even when there is no previous lesson,
  // so the two buttons never trade sides.
  const placement = isNext ? "items-end text-right sm:col-start-2" : "items-start text-left";
  return (
    <Link href={link.href} className={`${BUTTON_CLASS} ${placement}`}>
      <span className={CAPTION_CLASS}>
        {!isNext && <span aria-hidden="true">&lt;- </span>}
        {direction} <span aria-hidden="true">·</span> {link.number}
        {isNext && <span aria-hidden="true"> -&gt;</span>}
      </span>{" "}
      <span className={TITLE_CLASS}>{link.title}</span>
    </Link>
  );
}

export function LessonNav({
  previous,
  next,
  practice,
}: {
  previous?: NeighbourLink;
  next: NeighbourLink;
  practice: PracticeGroup[];
}): JSX.Element {
  return (
    <div className="mt-16 max-w-2xl space-y-10 border-t border-[var(--border)] pt-10">
      {practice.length > 0 && (
        <section aria-labelledby="lesson-practise-this">
          <h2 id="lesson-practise-this" className={CAPTION_CLASS}>
            practise this
          </h2>
          <div className={`mt-4 grid gap-6 ${practice.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {practice.map(({ side, links }) => (
              <div key={side.id}>
                <h3 className="mb-2 font-sans text-sm font-semibold text-[var(--text-secondary)]">
                  {side.title}
                </h3>
                <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={PRACTICE_ROW_CLASS}>
                        <span className={TITLE_CLASS}>{link.title}</span>{" "}
                        {link.difficulty && (
                          <span className="font-mono text-[12px] text-[var(--text-tertiary)]">
                            {link.difficulty}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      <nav aria-label="Previous and next lesson" className="grid gap-3 sm:grid-cols-2">
        {previous && <NeighbourButton link={previous} direction="previous" />}
        <NeighbourButton link={next} direction="next" />
      </nav>
    </div>
  );
}
