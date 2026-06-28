"use client";

/**
 * The two-pane instruction reference. The left pane is a sticky, filterable,
 * keyboard-navigable index grouped by category; the right pane is the
 * per-instruction detail. Usage prose renders only through the shared
 * sanitizing Markdown renderer, the example through the read-only code block,
 * and the encoding through the bit-field diagram when the instruction has one;
 * the try-in-playground link composes the shared share-hash. Data arrives as a
 * prop and the type is the only import from the data module, so this stays
 * decoupled from the emulator. Selecting an instruction reflects a stable
 * per-mnemonic id into the URL fragment so a detail is permalinkable; the
 * fragment is read through useSyncExternalStore so the first client render
 * matches the server and then restores the selection after hydration.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import type { ReferenceInstruction, ReferenceCategory } from "@/lib/reference-data";
import { LessonMarkdown } from "@/components/LessonMarkdown";
import { CodeBlock } from "@/components/CodeBlock";
import { BitFieldDiagram } from "@/components/BitFieldDiagram";
import { buildShareHash } from "@/lib/share";
import { playgroundSource } from "@/lib/playground-source";

/**
 * Stable, fragment-safe id for a mnemonic: lowercased with dots turned into
 * dashes so `b.cond` becomes `b-cond`. The one helper drives the element id, the
 * URL fragment written on select, and the on-load lookup, so the three agree.
 */
function hashId(mnemonic: string): string {
  return mnemonic.toLowerCase().replace(/\./g, "-");
}

/**
 * The usage prose handed to the single sanitizing renderer: the one-line summary
 * plus the C-equivalent as inline code when the data carries one, so register
 * and instruction tokens in the prose still hover-define.
 */
function buildUsage(instruction: ReferenceInstruction): string {
  return instruction.cExample
    ? `${instruction.summary}\n\nin C: \`${instruction.cExample}\``
    : instruction.summary;
}

// The URL fragment as an external store: the server snapshot and the first
// client render read empty (matching the server), then the post-hydration read
// returns the real fragment id without a setState-in-effect.
function subscribeHash(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function readHashFragment(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

const ITEM_BASE =
  "flex min-h-[44px] w-full items-center rounded-[var(--radius-control)] border-l-2 px-3 text-left font-mono text-[14px] outline-none transition-colors focus-visible:[box-shadow:var(--ring)]";
const ITEM_SELECTED = "border-[var(--cyan)] text-[var(--cyan)]";
const ITEM_IDLE =
  "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]";
const GROUP_LABEL =
  "px-2 [font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]";
const DETAIL_CATEGORY =
  "[font:var(--type-label)] uppercase tracking-wide text-[var(--text-tertiary)]";
const ACTION_LINK =
  "inline-flex min-h-[44px] items-center gap-1.5 text-[var(--cyan)] [font:var(--type-small)] outline-none hover:underline focus-visible:[box-shadow:var(--ring)]";
const PERMALINK =
  "inline-flex min-h-[44px] items-center font-mono text-[13px] text-[var(--cyan)] outline-none hover:underline focus-visible:[box-shadow:var(--ring)]";

export function InstructionReference({
  instructions,
}: {
  instructions: ReferenceInstruction[];
}): JSX.Element {
  const [filter, setFilter] = useState("");
  // `picked` is the user's explicit choice (click / Enter); `activePick` is the
  // roving keyboard focus that the arrows move. Both stay null until the user
  // acts, so the fragment store drives the initial selection.
  const [picked, setPicked] = useState<string | null>(null);
  const [activePick, setActivePick] = useState<string | null>(null);

  const fragment = useSyncExternalStore(subscribeHash, readHashFragment, () => "");

  const filterId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Category order follows first appearance in the data, so the index sections
  // keep the document's order rather than an alphabetical one.
  const categoryOrder = useMemo(() => {
    const order: ReferenceCategory[] = [];
    const seen = new Set<ReferenceCategory>();
    for (const instruction of instructions) {
      if (!seen.has(instruction.category)) {
        seen.add(instruction.category);
        order.push(instruction.category);
      }
    }
    return order;
  }, [instructions]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return instructions;
    return instructions.filter((instruction) =>
      instruction.mnemonic.toLowerCase().includes(query),
    );
  }, [instructions, filter]);

  const groups = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          items: filtered.filter(
            (instruction) => instruction.category === category,
          ),
        }))
        .filter((group) => group.items.length > 0),
    [categoryOrder, filtered],
  );

  // Flattened in the same order the index renders, so arrow nav steps through
  // the visible list across category boundaries.
  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  // The user's pick wins; otherwise the fragment when it names a known
  // instruction; otherwise the first instruction.
  const selected = useMemo(() => {
    if (picked !== null && instructions.some((i) => i.mnemonic === picked)) {
      return picked;
    }
    const fromFragment = instructions.find((i) => hashId(i.mnemonic) === fragment);
    if (fromFragment) return fromFragment.mnemonic;
    return instructions[0]?.mnemonic ?? "";
  }, [picked, fragment, instructions]);

  const active = useMemo(() => {
    if (
      activePick !== null &&
      instructions.some((i) => i.mnemonic === activePick)
    ) {
      return activePick;
    }
    return selected;
  }, [activePick, instructions, selected]);

  const current = useMemo(
    () => instructions.find((i) => i.mnemonic === selected) ?? instructions[0],
    [instructions, selected],
  );

  // On mount, bring the fragment-named instruction's index item into view.
  // Scroll only -- selection itself comes from the fragment store above.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;
    const match = instructions.find((i) => hashId(i.mnemonic) === raw);
    if (match) {
      itemRefs.current[match.mnemonic]?.scrollIntoView({ block: "nearest" });
    }
  }, [instructions]);

  function openInstruction(mnemonic: string) {
    setPicked(mnemonic);
    setActivePick(mnemonic);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${hashId(mnemonic)}`);
    }
    itemRefs.current[mnemonic]?.scrollIntoView({ block: "nearest" });
  }

  function moveActive(delta: 1 | -1) {
    if (flat.length === 0) return;
    const index = flat.findIndex((i) => i.mnemonic === active);
    // Clamp at the ends (no wrap); when the focus fell outside the filtered set,
    // step in from the matching edge.
    const nextIndex =
      index < 0
        ? delta === 1
          ? 0
          : flat.length - 1
        : Math.min(Math.max(index + delta, 0), flat.length - 1);
    const next = flat[nextIndex];
    setActivePick(next.mnemonic);
    const node = itemRefs.current[next.mnemonic];
    node?.focus();
    node?.scrollIntoView({ block: "nearest" });
  }

  function onIndexKeyDown(event: KeyboardEvent<HTMLElement>) {
    switch (event.key) {
      case "/":
        event.preventDefault();
        inputRef.current?.focus();
        break;
      case "Escape":
        event.preventDefault();
        setFilter("");
        break;
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Enter":
        event.preventDefault();
        openInstruction(active);
        break;
    }
  }

  function onFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setFilter("");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 lg:sticky lg:top-24 lg:h-fit lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <label
          htmlFor={filterId}
          className="[font:var(--type-label)] uppercase tracking-wide text-[var(--text-secondary)]"
        >
          filter
        </label>
        <input
          ref={inputRef}
          id={filterId}
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={onFilterKeyDown}
          placeholder="filter mnemonics (press / to focus)"
          className="block min-h-[44px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 font-mono text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:border-[var(--focus)] focus-visible:[box-shadow:var(--ring)]"
        />

        <nav
          aria-label="instruction index"
          onKeyDown={onIndexKeyDown}
          className="flex flex-col gap-4"
        >
          {groups.length === 0 ? (
            <p className="px-2 [font:var(--type-small)] text-[var(--text-tertiary)]">
              no instructions match.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-1">
                <p className={GROUP_LABEL}>{group.category}</p>
                <ul className="flex flex-col">
                  {group.items.map((instruction) => {
                    const isSelected = instruction.mnemonic === selected;
                    return (
                      <li key={instruction.mnemonic}>
                        <button
                          type="button"
                          id={hashId(instruction.mnemonic)}
                          ref={(node) => {
                            itemRefs.current[instruction.mnemonic] = node;
                          }}
                          onClick={() => openInstruction(instruction.mnemonic)}
                          onFocus={() => setActivePick(instruction.mnemonic)}
                          aria-current={isSelected ? "true" : undefined}
                          className={`${ITEM_BASE} ${
                            isSelected ? ITEM_SELECTED : ITEM_IDLE
                          }`}
                        >
                          {instruction.mnemonic}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>
      </div>

      <section
        aria-label="instruction detail"
        className="flex min-w-0 flex-col gap-4"
      >
        {current && (
          <>
            <header className="flex flex-col gap-1">
              <h2 className="font-mono text-[26px] font-semibold text-[var(--text-primary)]">
                {current.mnemonic}
              </h2>
              <p className={DETAIL_CATEGORY}>{current.category}</p>
            </header>

            <p className="font-mono text-[14px] text-[var(--text-secondary)]">
              {current.syntax}
            </p>

            <LessonMarkdown markdown={buildUsage(current)} />

            <CodeBlock code={current.example} />

            {current.gotchas && current.gotchas.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[var(--text-secondary)] [font:var(--type-body)]">
                {current.gotchas.map((gotcha, index) => (
                  <li key={index}>{gotcha}</li>
                ))}
              </ul>
            )}

            {current.encoding && (
              <BitFieldDiagram
                fields={current.encoding}
                label={`${current.mnemonic} encoding`}
              />
            )}

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={`/playground${buildShareHash({ source: playgroundSource(current) })}`}
                className={ACTION_LINK}
              >
                Try in playground <span aria-hidden="true">-&gt;</span>
              </Link>
              <a href={`#${hashId(current.mnemonic)}`} className={PERMALINK}>
                #{hashId(current.mnemonic)}
              </a>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
