"use client";

/**
 * The learn index: ruled datasheet rows ordered by metadata, with a labeled
 * search box, a tag filter, and empty + loading states. It receives
 * already-validated lessons as props from the server index page and renders
 * every row field as plain React text (auto-escaped), so there is no
 * markdown/HTML injection path here.
 *
 * Each row leads with its sheet number `4.N` (the 1-based position in the
 * sorted order, stable under filtering), then the title and a quieter
 * description line, inside one bordered container with hairlines between rows.
 */

import { useId, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import type { Lesson } from "@/lib/content/lesson-schema";
import { compareByOrder } from "@/lib/content/content-order";

const ROW_CLASS =
  "group grid min-h-[52px] grid-cols-[3.5rem_1fr] items-baseline gap-x-4 px-4 py-3 outline-none hover:bg-[var(--bg-raised)] focus-visible:[box-shadow:var(--ring)]";
const CHIP_CLASS =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[var(--text-secondary)] outline-none [font:var(--type-small)] hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)] aria-pressed:border-[var(--cyan)] aria-pressed:bg-[var(--cyan)] aria-pressed:text-[var(--on-cyan)]";

/** A quiet placeholder card, reused for the no-lessons and no-match states. */
function EmptyCard({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-6">
      <p className="text-[var(--text-tertiary)] [font:var(--type-body)]">{message}</p>
    </div>
  );
}

export function LessonIndex({
  lessons,
  loading,
}: {
  lessons: Lesson[];
  loading?: boolean;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const searchId = useId();

  // Sheet numbers come from the sorted position, so they stay stable when the
  // search or tag filter hides rows.
  const numbered = useMemo(
    () =>
      [...lessons]
        .sort(compareByOrder)
        .map((lesson, index) => ({ lesson, sheetNumber: `4.${index + 1}` })),
    [lessons],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const { lesson } of numbered) for (const tag of lesson.tags ?? []) set.add(tag);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [numbered]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return numbered.filter(({ lesson }) => {
      const haystack = [lesson.title, lesson.summary ?? "", ...(lesson.tags ?? [])]
        .join(" ")
        .toLowerCase();
      const matchesQuery = q === "" || haystack.includes(q);
      const matchesTags =
        activeTags.size === 0 || (lesson.tags ?? []).some((tag) => activeTags.has(tag));
      return matchesQuery && matchesTags;
    });
  }, [numbered, query, activeTags]);

  function toggleTag(tag: string): void {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  if (loading) {
    return (
      <div
        aria-busy="true"
        data-testid="lesson-index-skeleton"
        className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[52px] bg-[var(--bg-sunken)]" />
        ))}
      </div>
    );
  }

  if (numbered.length === 0) {
    return <EmptyCard message="No lessons yet." />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <label htmlFor={searchId} className="sr-only">
            Search lessons
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons"
            className="w-full min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2 text-[var(--text-primary)] outline-none [font:var(--type-body)] placeholder:text-[var(--text-tertiary)] focus-visible:shadow-[var(--ring)]"
          />
        </div>
        {allTags.length > 0 && (
          <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={activeTags.has(tag)}
                onClick={() => toggleTag(tag)}
                className={CHIP_CLASS}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyCard message="No lessons match your search." />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]">
          {filtered.map(({ lesson, sheetNumber }) => (
            <li key={lesson.slug}>
              <Link href={`/learn/${lesson.slug}`} className={ROW_CLASS}>
                <span className="font-mono text-[13px] font-medium text-[var(--text-tertiary)] group-hover:text-[var(--amber)]">
                  {sheetNumber}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-sans text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--cyan)]">
                    {lesson.title}
                  </span>
                  {lesson.summary && (
                    <span className="text-sm text-[var(--text-secondary)]">{lesson.summary}</span>
                  )}
                  {lesson.tags && lesson.tags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {lesson.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-[11px] text-[var(--text-tertiary)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
