"use client";

/**
 * The learn index: lesson cards ordered by metadata, with a labeled search box,
 * a tag filter, and empty + loading states. It receives already-validated
 * lessons as props from the server index page and renders every card field as
 * plain React text (auto-escaped), so there is no markdown/HTML injection path
 * here.
 */

import { useId, useMemo, useState, type JSX } from "react";
import Link from "next/link";
import type { Lesson } from "@/lib/lesson-schema";
import { compareByOrder } from "@/lib/content-order";

const CARD_CLASS =
  "flex min-h-[44px] flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-4 outline-none hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)]";
const CHIP_CLASS =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[var(--text-secondary)] outline-none [font:var(--type-small)] hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)] aria-pressed:border-[var(--cyan)] aria-pressed:text-[var(--cyan)]";

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

  const sorted = useMemo(
    () => [...lessons].sort(compareByOrder),
    [lessons],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const lesson of sorted) for (const tag of lesson.tags ?? []) set.add(tag);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [sorted]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((lesson) => {
      const haystack = [lesson.title, lesson.summary ?? "", ...(lesson.tags ?? [])]
        .join(" ")
        .toLowerCase();
      const matchesQuery = q === "" || haystack.includes(q);
      const matchesTags =
        activeTags.size === 0 || (lesson.tags ?? []).some((tag) => activeTags.has(tag));
      return matchesQuery && matchesTags;
    });
  }, [sorted, query, activeTags]);

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
      <div aria-busy="true" data-testid="lesson-index-skeleton" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]"
          />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
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
        <ul className="space-y-3">
          {filtered.map((lesson) => (
            <li key={lesson.slug}>
              <Link href={`/learn/${lesson.slug}`} className={CARD_CLASS}>
                <span className="text-[var(--text-primary)] [font:var(--type-h3)]">
                  {lesson.title}
                </span>
                {lesson.summary && (
                  <span className="text-[var(--text-secondary)] [font:var(--type-body)]">
                    {lesson.summary}
                  </span>
                )}
                {lesson.tags && lesson.tags.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-2">
                    {lesson.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[var(--radius-control)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--text-tertiary)] [font:var(--type-small)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
