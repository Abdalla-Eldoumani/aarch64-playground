"use client";

/**
 * The practice index: exercise cards ordered by metadata, with a labeled search
 * box, topic and difficulty filters, a solved/unsolved indicator, and empty +
 * loading states. It receives already-validated exercises as props from the
 * server index page and renders every card field as plain React text
 * (auto-escaped) - the blurb is plain-text-derived from the prompt, never
 * Markdown - so there is no markdown/HTML injection path here.
 *
 * Solved state comes from a useSyncExternalStore over the solved-state store:
 * the server snapshot is empty, so the server and first client render agree and
 * the solved badges appear after hydration without a mismatch, then update live
 * when a check passes here or in another tab.
 */

import { useId, useMemo, useState, useSyncExternalStore, type JSX } from "react";
import Link from "next/link";
import type { Exercise } from "@/lib/exercise-schema";
import { getSolvedSlugs, subscribeSolved } from "@/lib/solved-state";

// useSyncExternalStore needs getSnapshot to return a stable reference until the
// value actually changes; getSolvedSlugs() reads localStorage and returns a
// fresh array each call, so the snapshot is cached in module scope and refreshed
// on a change. The empty server snapshot keeps the first client render matching
// the server (no hydration mismatch); the solved badges fill in after.
let cachedSolved: string[] = getSolvedSlugs();
const EMPTY_SOLVED: string[] = [];

function readSolved(): string[] {
  return cachedSolved;
}

function readServerSolved(): string[] {
  return EMPTY_SOLVED;
}

function subscribeSolvedSnapshot(callback: () => void): () => void {
  cachedSolved = getSolvedSlugs();
  return subscribeSolved(() => {
    cachedSolved = getSolvedSlugs();
    callback();
  });
}

/**
 * The same ordering rule the server loader uses (numbers numerically, strings
 * via localeCompare, mixed by string). It is re-implemented here rather than
 * imported because the loader is server-only (it imports node:fs); this is a
 * defensive re-sort of data that already arrives ordered.
 */
function compareOrder(a: Exercise["order"], b: Exercise["order"]): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return String(a).localeCompare(String(b));
}

/** Difficulty order for the filter chips, so they read intro -> core -> challenge. */
const DIFFICULTY_RANK: Record<string, number> = { intro: 0, core: 1, challenge: 2 };

/**
 * A plain-text card summary from the prompt: the first non-empty line with
 * leading Markdown markers (#, >, -, *) stripped, clipped to a card-sized
 * length. Rendered as plain text, never Markdown.
 */
function blurbFromPrompt(prompt: string): string {
  const firstLine =
    prompt
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const plain = firstLine.replace(/^[#>\-*\s]+/, "").trim();
  return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain;
}

const CARD_CLASS =
  "flex min-h-[44px] flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-4 outline-none hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)]";
const CHIP_CLASS =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[var(--text-secondary)] outline-none [font:var(--type-small)] hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)] aria-pressed:border-[var(--cyan)] aria-pressed:text-[var(--cyan)]";
const TAG_CLASS =
  "rounded-[var(--radius-control)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--text-tertiary)] [font:var(--type-small)]";
const BADGE_CLASS =
  "rounded-[var(--radius-control)] border border-[var(--border)] px-2 py-0.5 text-[var(--text-secondary)] [font:var(--type-small)]";

/** A quiet placeholder card, reused for the no-exercises and no-match states. */
function EmptyCard({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-6">
      <p className="text-[var(--text-tertiary)] [font:var(--type-body)]">{message}</p>
    </div>
  );
}

/** Toggle a value in a Set, returning a new Set. */
function toggleValue(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ExerciseIndex({
  exercises,
  loading,
}: {
  exercises: Exercise[];
  loading?: boolean;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeTopics, setActiveTopics] = useState<Set<string>>(new Set());
  const [activeDifficulties, setActiveDifficulties] = useState<Set<string>>(new Set());
  const searchId = useId();

  // Empty on the server and the first client render, then the real solved set
  // after hydration; never reads localStorage during render.
  const solved = useSyncExternalStore(subscribeSolvedSnapshot, readSolved, readServerSolved);
  const solvedSet = useMemo(() => new Set(solved), [solved]);

  const cards = useMemo(
    () =>
      [...exercises]
        .sort((a, b) => compareOrder(a.order, b.order))
        .map((exercise) => ({ exercise, blurb: blurbFromPrompt(exercise.prompt) })),
    [exercises],
  );

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    for (const { exercise } of cards) if (exercise.topic) set.add(exercise.topic);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const allDifficulties = useMemo(() => {
    const set = new Set<string>();
    for (const { exercise } of cards) if (exercise.difficulty) set.add(exercise.difficulty);
    return [...set].sort((a, b) => (DIFFICULTY_RANK[a] ?? 99) - (DIFFICULTY_RANK[b] ?? 99));
  }, [cards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(({ exercise, blurb }) => {
      const haystack = [exercise.title, exercise.topic ?? "", exercise.difficulty ?? "", blurb]
        .join(" ")
        .toLowerCase();
      const matchesQuery = q === "" || haystack.includes(q);
      const matchesTopic =
        activeTopics.size === 0 || (exercise.topic ? activeTopics.has(exercise.topic) : false);
      const matchesDifficulty =
        activeDifficulties.size === 0 ||
        (exercise.difficulty ? activeDifficulties.has(exercise.difficulty) : false);
      return matchesQuery && matchesTopic && matchesDifficulty;
    });
  }, [cards, query, activeTopics, activeDifficulties]);

  if (loading) {
    return (
      <div aria-busy="true" data-testid="exercise-index-skeleton" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]"
          />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return <EmptyCard message="No exercises yet." />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <label htmlFor={searchId} className="sr-only">
            Search exercises
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search exercises"
            className="w-full min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2 text-[var(--text-primary)] outline-none [font:var(--type-body)] placeholder:text-[var(--text-tertiary)] focus-visible:shadow-[var(--ring)]"
          />
        </div>
        {allTopics.length > 0 && (
          <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-2">
            {allTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                aria-pressed={activeTopics.has(topic)}
                onClick={() => setActiveTopics((prev) => toggleValue(prev, topic))}
                className={CHIP_CLASS}
              >
                {topic}
              </button>
            ))}
          </div>
        )}
        {allDifficulties.length > 0 && (
          <div role="group" aria-label="Filter by difficulty" className="flex flex-wrap gap-2">
            {allDifficulties.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                aria-pressed={activeDifficulties.has(difficulty)}
                onClick={() => setActiveDifficulties((prev) => toggleValue(prev, difficulty))}
                className={CHIP_CLASS}
              >
                {difficulty}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyCard message="No exercises match your search." />
      ) : (
        <ul className="space-y-3">
          {filtered.map(({ exercise, blurb }) => {
            const isCardSolved = solvedSet.has(exercise.slug);
            return (
              <li key={exercise.slug}>
                <Link href={`/practice/${exercise.slug}`} className={CARD_CLASS}>
                  <span className="text-[var(--text-primary)] [font:var(--type-h3)]">
                    {exercise.title}
                  </span>
                  {blurb && (
                    <span className="text-[var(--text-secondary)] [font:var(--type-body)]">
                      {blurb}
                    </span>
                  )}
                  {(exercise.topic || exercise.difficulty || isCardSolved) && (
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {exercise.topic && <span className={TAG_CLASS}>{exercise.topic}</span>}
                      {exercise.difficulty && (
                        <span className={BADGE_CLASS}>{exercise.difficulty}</span>
                      )}
                      {isCardSolved && (
                        <span className="inline-flex items-center gap-1 text-[var(--success)] [font:var(--type-small)]">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-[var(--success)]"
                          />
                          solved
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
