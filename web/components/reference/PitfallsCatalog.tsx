"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type JSX } from "react";
import { Button } from "@/components/ui/Button";
import { PitfallCard, type PitfallVariant } from "@/components/reference/PitfallCard";
import {
  PITFALLS,
  PITFALL_GROUPS,
  type Pitfall,
  type PitfallGroup,
} from "@/lib/content/pitfall-data";
import { pitfallFragment } from "@/lib/content/site";
import { useHashFragment } from "@/lib/hooks/use-hash-fragment";

/**
 * The common mistakes, in groups, with a text box and group buttons that
 * narrow the list. Only one demo runs at a time, loaded on demand, so
 * browsing the list loads no emulator.
 */

const CHIP_CLASS =
  "inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[var(--text-secondary)] outline-none [font:var(--type-small)] hover:border-[var(--cyan)] focus-visible:[box-shadow:var(--ring)] aria-pressed:border-[var(--cyan)] aria-pressed:bg-[var(--cyan)] aria-pressed:text-[var(--on-cyan)]";

interface OpenDemo {
  slug: string;
  variant: PitfallVariant;
}

// What the filter searches: everything a card shows, read once.
const SEARCH_TEXT = new Map<Pitfall, string>(
  PITFALLS.map((pitfall) => [
    pitfall,
    [
      pitfall.title,
      pitfall.mistake,
      pitfall.server,
      pitfall.playground,
      pitfall.fix,
      pitfall.wrong,
      pitfall.right,
      pitfall.reference,
    ]
      .join("\n")
      .toLowerCase(),
  ]),
);

export function PitfallsCatalog({
  lessonTitles,
  className = "",
}: {
  /** Lesson titles by slug, for each card's lesson link. */
  lessonTitles: Record<string, string>;
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState<OpenDemo | null>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Set<PitfallGroup>>(new Set());
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const fragment = useHashFragment();

  const sections = useMemo(() => {
    const words = query.trim().toLowerCase();
    const shown = PITFALLS.filter(
      (pitfall) =>
        (groups.size === 0 || groups.has(pitfall.group)) &&
        (words === "" || (SEARCH_TEXT.get(pitfall) ?? "").includes(words)),
    );
    return PITFALL_GROUPS.map((group) => ({
      group,
      pitfalls: shown.filter((pitfall) => pitfall.group === group.id),
    })).filter((section) => section.pitfalls.length > 0);
  }, [query, groups]);
  const shownCount = sections.reduce((sum, section) => sum + section.pitfalls.length, 0);
  const filtered = query.trim() !== "" || groups.size > 0;

  // A link to one card (#pitfall-<slug>) opens this tab before the card
  // exists, so the browser's own jump to it never happens: bring it into
  // view once it has rendered. Nothing is filtered yet on that first render.
  useEffect(() => {
    if (!fragment.startsWith(pitfallFragment(""))) return;
    document.getElementById(fragment)?.scrollIntoView({ block: "start" });
  }, [fragment]);

  // Stable, so a click re-renders only the cards whose demo changed.
  const onRun = useCallback((slug: string, variant: PitfallVariant) => {
    setOpen((current) =>
      current && current.slug === slug && current.variant === variant
        ? null
        : { slug, variant },
    );
  }, []);

  function toggleGroup(id: PitfallGroup) {
    setGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // The clear button removes itself, so focus goes to the text box instead
  // of falling back to the top of the page.
  function clearFilters() {
    setQuery("");
    setGroups(new Set());
    searchRef.current?.focus();
  }

  return (
    <section
      aria-label="common mistakes"
      className={`mx-auto flex max-w-3xl flex-col gap-10 ${className}`}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[var(--text-secondary)] [font:var(--type-body)]">
          Each mistake comes with a broken program and its fix, both run on
          the course server. Each card says what the server and the
          playground do with the broken one.
        </p>
        <label htmlFor={searchId} className="sr-only">
          filter the mistakes
        </label>
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="filter by word or instruction"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="block min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-0 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:border-[var(--focus)] focus-visible:[box-shadow:var(--ring)]"
        />
        <div role="group" aria-label="filter by group" className="flex flex-wrap gap-2">
          {PITFALL_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              aria-pressed={groups.has(group.id)}
              onClick={() => toggleGroup(group.id)}
              className={CHIP_CLASS}
            >
              {group.short}
            </button>
          ))}
        </div>
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-1">
          <p aria-live="polite" className="text-[var(--text-tertiary)] [font:var(--type-small)]">
            {filtered
              ? `${shownCount} of ${PITFALLS.length} mistakes shown`
              : `${PITFALLS.length} mistakes`}
          </p>
          {filtered && (
            <Button variant="ghost" onClick={clearFilters} className="touch-target">
              clear the filters
            </Button>
          )}
        </div>
      </div>

      {sections.length === 0 && (
        <p className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-6 text-[var(--text-secondary)] [font:var(--type-body)]">
          No mistake matches that filter. Try an instruction such as ldr or
          cmp, or clear the filters.
        </p>
      )}

      {sections.map(({ group, pitfalls }) => (
        <section
          key={group.id}
          aria-labelledby={`pitfall-group-${group.id}`}
          className="flex flex-col gap-10"
        >
          <h2
            id={`pitfall-group-${group.id}`}
            className="border-b border-[var(--border)] pb-2 text-[var(--text-primary)] [font:var(--type-h2)]"
          >
            {group.label}
          </h2>
          {pitfalls.map((pitfall) => (
            <PitfallCard
              key={pitfall.slug}
              pitfall={pitfall}
              lessonTitle={lessonTitles[pitfall.lesson] ?? pitfall.lesson}
              running={open?.slug === pitfall.slug ? open.variant : null}
              onRun={onRun}
            />
          ))}
        </section>
      ))}
    </section>
  );
}
