"use client";

/**
 * The practice index: ruled datasheet rows ordered by metadata, with a labeled
 * search box, topic and difficulty filters, a solved/unsolved indicator, and
 * empty + loading states. It receives already-validated exercises as props from
 * the server index page and renders every row field as plain React text
 * (auto-escaped) - the blurb is plain-text-derived from the prompt, never
 * Markdown - so there is no markdown/HTML injection path here.
 *
 * Each row leads with its sheet number `5.N` (the 1-based position in the
 * sorted order, stable under filtering), then the title, a quieter blurb line,
 * and the topic/difficulty/solved meta, inside one bordered container with
 * hairlines between rows.
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
import { compareByOrder } from "@/lib/content-order";

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

/** Difficulty order for the filter chips, so they read intro -> core -> challenge. */
const DIFFICULTY_RANK: Record<string, number> = { intro: 0, core: 1, challenge: 2 };

/**
 * A plain-text row summary from the prompt: the first non-empty line with
 * leading Markdown markers (#, >, -, *) stripped, clipped to a row-sized
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

const ROW_CLASS =
  "group grid min-h-[52px] grid-cols-[3.5rem_1fr] items-baseline gap-x-4 px-4 py-3 outline-none hover:bg-[var(--bg-raised)] focus-visible:[box-shadow:var(--ring)]";
const CHIP_CLASS =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[var(--text-secondary)] outline-none [font:var(--type-small)] hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)] aria-pressed:border-[var(--cyan)] aria-pressed:bg-[var(--cyan)] aria-pressed:text-[var(--on-cyan)]";
const META_CLASS = "font-mono text-[11px] text-[var(--text-tertiary)]";

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

  // Sheet numbers come from the sorted position, so they stay stable when the
  // search or filters hide rows.
  const rows = useMemo(
    () =>
      [...exercises].sort(compareByOrder).map((exercise, index) => ({
        exercise,
        blurb: blurbFromPrompt(exercise.prompt),
        sheetNumber: `5.${index + 1}`,
      })),
    [exercises],
  );

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    for (const { exercise } of rows) if (exercise.topic) set.add(exercise.topic);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const allDifficulties = useMemo(() => {
    const set = new Set<string>();
    for (const { exercise } of rows) if (exercise.difficulty) set.add(exercise.difficulty);
    return [...set].sort((a, b) => (DIFFICULTY_RANK[a] ?? 99) - (DIFFICULTY_RANK[b] ?? 99));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ exercise, blurb }) => {
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
  }, [rows, query, activeTopics, activeDifficulties]);

  if (loading) {
    return (
      <div
        aria-busy="true"
        data-testid="exercise-index-skeleton"
        className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[52px] bg-[var(--bg-sunken)]" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
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
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]">
          {filtered.map(({ exercise, blurb, sheetNumber }) => {
            const isRowSolved = solvedSet.has(exercise.slug);
            return (
              <li key={exercise.slug}>
                <Link href={`/practice/${exercise.slug}`} className={ROW_CLASS}>
                  <span className="font-mono text-[13px] font-medium text-[var(--text-tertiary)] group-hover:text-[var(--amber)]">
                    {sheetNumber}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-sans text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--cyan)]">
                      {exercise.title}
                    </span>
                    {blurb && (
                      <span className="text-sm text-[var(--text-secondary)]">{blurb}</span>
                    )}
                    {(exercise.topic || exercise.difficulty || isRowSolved) && (
                      <span className="mt-1 flex flex-wrap items-center gap-3">
                        {exercise.topic && <span className={META_CLASS}>{exercise.topic}</span>}
                        {exercise.difficulty && (
                          <span className={META_CLASS}>{exercise.difficulty}</span>
                        )}
                        {isRowSolved && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--success)]">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 rounded-full bg-[var(--success)]"
                            />
                            solved
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
