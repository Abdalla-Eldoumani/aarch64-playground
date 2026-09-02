"use client";

/**
 * The practice index: two columns of ruled datasheet rows, coding exercises
 * on the left and theory sets on the right, each grouped by topic in course
 * order (lib/content/practice-topics owns both the split and the order). A
 * shared search box and difficulty filter sit above both columns, plus a
 * solved indicator, empty and loading states, and the progress row. It
 * receives already-validated index rows as props from the
 * server index page (loadExerciseIndex narrows each exercise to the seven
 * fields below, blurb included) and renders every row field as plain React
 * text (auto-escaped), so there is no markdown/HTML injection path here.
 *
 * Each row leads with its sheet number `5.N` (the 1-based position in the
 * sorted order, stable under filtering), then the title, a quieter blurb line,
 * and the difficulty/solved meta, inside one bordered container per column
 * with hairlines between rows and a sunken band at each topic boundary.
 *
 * Solved state comes from a useSyncExternalStore over the solved-state store:
 * the server snapshot is empty, so the server and first client render agree and
 * the solved badges appear after hydration without a mismatch, then update live
 * when a check passes here or in another tab.
 *
 * A quiet progress row below the columns exports that set as a small json file
 * and imports one back, since localStorage is the only place it lives.
 */

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type JSX,
} from "react";
import Link from "next/link";
import type { ExerciseIndexRow } from "@/lib/content/exercise-schema";
import {
  buildProgressBundle,
  getSolvedSlugs,
  importProgressBundle,
  subscribeSolved,
} from "@/lib/playground/solved-state";
import { compareByOrder } from "@/lib/content/content-order";
import {
  PRACTICE_SIDES,
  practiceSide,
  topicLabel,
  topicRank,
  type PracticeSideInfo,
} from "@/lib/content/practice-topics";
import { useToast } from "@/components/ui/Toast";
import { MAX_BOOKMARK_JSON_BYTES, checkUploadSize } from "@/lib/playground/upload-guard";

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

const ROW_CLASS =
  "group grid min-h-[52px] grid-cols-[3.5rem_1fr] items-baseline gap-x-4 px-4 py-3 outline-none hover:bg-[var(--bg-raised)] focus-visible:[box-shadow:var(--ring)]";
const CHIP_CLASS =
  "inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[var(--text-secondary)] outline-none [font:var(--type-small)] hover:border-[var(--cyan)] focus-visible:shadow-[var(--ring)] aria-pressed:border-[var(--cyan)] aria-pressed:bg-[var(--cyan)] aria-pressed:text-[var(--on-cyan)]";
const META_CLASS = "font-mono text-[11px] text-[var(--text-tertiary)]";
const CAPTION_CLASS = "font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]";

/** A quiet placeholder card, reused for the no-exercises and no-match states. */
function EmptyCard({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-5 py-6">
      <p className="text-[var(--text-tertiary)] [font:var(--type-body)]">{message}</p>
    </div>
  );
}

const PROGRESS_LINK_CLASS =
  "inline-flex min-h-[24px] items-center rounded-[var(--radius-control)] px-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--cyan)] focus:outline-none focus-visible:[box-shadow:var(--ring)]";

/**
 * Export / import for the solved set and the answers saved beside it. Both
 * live only in this browser's localStorage, which Safari evicts after seven
 * days without a visit, so this small file is the only way progress leaves
 * the device or comes back. Importing merges, never replaces.
 */
function ProgressRow(): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const exportProgress = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildProgressBundle(), null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aarch64-playground-progress.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const onFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Cleared before any early return, so picking the same file twice in
      // a row still fires a change event.
      event.target.value = "";
      if (!file) return;
      // Sized off file.size, before the read: the cap is here to keep a
      // hostile file from being pulled into the tab at all.
      const sizeError = checkUploadSize(file.size, MAX_BOOKMARK_JSON_BYTES, "progress file");
      if (sizeError) {
        toast.error(sizeError);
        return;
      }
      file
        .text()
        .then((raw) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            toast.error("that file is not valid json");
            return;
          }
          const result = importProgressBundle(parsed);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (result.added === 0 && result.answersAdded === 0) {
            toast.info("nothing new to import");
            return;
          }
          // Both halves are counted: a file can carry work for exercises
          // already ticked here, and reporting only the ticks would read as
          // "nothing happened" after the answers landed.
          const parts: string[] = [];
          if (result.added > 0) {
            parts.push(`${result.added} solved ${result.added === 1 ? "exercise" : "exercises"}`);
          }
          if (result.answersAdded > 0) {
            parts.push(
              `${result.answersAdded} saved ${result.answersAdded === 1 ? "answer" : "answers"}`,
            );
          }
          toast.success(`imported ${parts.join(" and ")}`);
        })
        .catch(() => {
          toast.error("could not read that file. pick it again");
        });
    },
    [toast],
  );

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-tertiary)]">
      <span>progress:</span>
      <button
        type="button"
        onClick={exportProgress}
        className={PROGRESS_LINK_CLASS}
        aria-label="export solved progress"
      >
        export
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={PROGRESS_LINK_CLASS}
        aria-label="import solved progress"
      >
        import
      </button>
      <input ref={fileRef} type="file" accept=".json" onChange={onFile} className="hidden" />
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

interface Row {
  exercise: ExerciseIndexRow;
  blurb: string;
  sheetNumber: string;
}

interface TopicGroup {
  topic: string | undefined;
  rows: Row[];
}

/**
 * Rows of one side bucketed by topic, groups in course order, rows inside a
 * group in sheet order. An exercise with no topic lands in a last, unlabeled
 * group rather than vanishing.
 */
function groupByTopic(rows: Row[]): TopicGroup[] {
  const groups = new Map<string | undefined, Row[]>();
  for (const row of rows) {
    const topic = row.exercise.topic;
    const bucket = groups.get(topic);
    if (bucket) bucket.push(row);
    else groups.set(topic, [row]);
  }
  return [...groups.entries()]
    .map(([topic, grouped]) => ({ topic, rows: grouped }))
    .sort((a, b) => topicRank(a.topic) - topicRank(b.topic));
}

function ExerciseRow({ row, isSolved }: { row: Row; isSolved: boolean }): JSX.Element {
  const { exercise, blurb, sheetNumber } = row;
  return (
    <li>
      <Link href={`/practice/${exercise.slug}`} className={ROW_CLASS}>
        <span className="font-mono text-[13px] font-medium text-[var(--text-tertiary)] group-hover:text-[var(--amber)]">
          {sheetNumber}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-sans text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--cyan)]">
            {exercise.title}
          </span>
          {blurb && <span className="text-sm text-[var(--text-secondary)]">{blurb}</span>}
          {(exercise.difficulty || isSolved) && (
            <span className="mt-1 flex flex-wrap items-center gap-3">
              {exercise.difficulty && <span className={META_CLASS}>{exercise.difficulty}</span>}
              {isSolved && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--success)]">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--success)]" />
                  solved
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * One column: its caption, title, and count, then the grouped rows. `all` is
 * the side's full row set (for the count line); `rows` is what survives the
 * search and difficulty filter.
 */
function SideColumn({
  side,
  all,
  rows,
  solvedSet,
}: {
  side: PracticeSideInfo;
  all: Row[];
  rows: Row[];
  solvedSet: Set<string>;
}): JSX.Element {
  const headingId = useId();
  const solvedCount = all.filter(({ exercise }) => solvedSet.has(exercise.slug)).length;
  const noun = all.length === 1 ? "exercise" : "exercises";
  const groups = groupByTopic(rows);

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <p className={CAPTION_CLASS}>{side.caption}</p>
        <h2
          id={headingId}
          className="font-serif text-2xl font-semibold leading-tight text-[var(--text-primary)]"
        >
          {side.title}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">{side.description}</p>
        <p className={META_CLASS}>
          {all.length} {noun}
          {solvedCount > 0 && ` · ${solvedCount} solved`}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyCard message="no exercises match that search" />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)]">
          {groups.map((group) => (
            <li key={group.topic ?? "untagged"}>
              <h3 className={`${CAPTION_CLASS} bg-[var(--bg-sunken)] px-4 py-2`}>
                {group.topic ? topicLabel(group.topic) : "other"}
                <span className="ml-2 normal-case tracking-normal">· {group.rows.length}</span>
              </h3>
              <ul className="divide-y divide-[var(--border)]">
                {group.rows.map((row) => (
                  <ExerciseRow
                    key={row.exercise.slug}
                    row={row}
                    isSolved={solvedSet.has(row.exercise.slug)}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExerciseIndex({
  exercises,
  loading,
}: {
  exercises: ExerciseIndexRow[];
  loading?: boolean;
}): JSX.Element {
  const [query, setQuery] = useState("");
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
        blurb: exercise.blurb,
        sheetNumber: `5.${index + 1}`,
      })),
    [exercises],
  );

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
      const matchesDifficulty =
        activeDifficulties.size === 0 ||
        (exercise.difficulty ? activeDifficulties.has(exercise.difficulty) : false);
      return matchesQuery && matchesDifficulty;
    });
  }, [rows, query, activeDifficulties]);

  // A side with nothing on the sheet at all is left out, so a content set
  // that is all coding exercises renders as one column rather than one
  // column and an empty card.
  const sides = PRACTICE_SIDES.map((side) => ({
    side,
    all: rows.filter(({ exercise }) => practiceSide(exercise) === side.id),
    rows: filtered.filter(({ exercise }) => practiceSide(exercise) === side.id),
  })).filter(({ all }) => all.length > 0);

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
    return <EmptyCard message="no exercises yet" />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <label htmlFor={searchId} className="sr-only">
            search exercises
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search exercises"
            className="w-full min-h-[44px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)] px-3 py-2 text-[var(--text-primary)] outline-none [font:var(--type-body)] placeholder:text-[var(--text-tertiary)] focus-visible:shadow-[var(--ring)]"
          />
        </div>
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

      <div className={`grid gap-10 ${sides.length > 1 ? "lg:grid-cols-2 lg:gap-8" : ""}`}>
        {sides.map(({ side, all, rows: sideRows }) => (
          <SideColumn key={side.id} side={side} all={all} rows={sideRows} solvedSet={solvedSet} />
        ))}
      </div>

      <ProgressRow />
    </div>
  );
}
