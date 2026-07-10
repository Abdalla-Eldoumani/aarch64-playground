"use client";

/**
 * Renders one validated lesson as a reading-measure article with a table of
 * contents. Every author-Markdown surface (prose and callout bodies) flows
 * through the single sanitizing LessonMarkdown so there is no second Markdown
 * path and no raw-HTML injection; code blocks reuse the read-only CodeBlock and
 * carry an Open-in-playground deep link built with the shared buildShareHash;
 * editor blocks reuse the one EmbeddablePlayground (embed chrome), never a fork.
 * An author-supplied editor stdin is bounded by validateStdin before it reaches
 * the embed, so an oversize input is dropped at this boundary rather than
 * forwarded into the worker. The toc is built from the same extractToc the
 * renderer ids its headings with, so anchors and heading ids always agree.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { Lesson } from "@/lib/lesson-schema";
import { extractToc } from "@/lib/lesson-toc";
import { LessonMarkdown } from "@/components/LessonMarkdown";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { EmbeddablePlayground } from "@/components/EmbeddablePlayground";
import { buildShareHash } from "@/lib/share";
import { validateStdin } from "@/lib/upload-guard";
import { DocRule } from "@/components/DocRule";
import { Kicker } from "@/components/Kicker";

/**
 * The author stdin only when it is present and within the stdin cap; otherwise
 * undefined, so an oversize input is dropped rather than seeded into the embed.
 */
function safeStdin(stdin: string | undefined): string | undefined {
  if (stdin === undefined) return undefined;
  return validateStdin(stdin) === null ? stdin : undefined;
}

const OPEN_IN_PLAYGROUND_CLASS =
  "mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-control)] text-[var(--cyan)] [font:var(--type-small)] outline-none hover:underline focus-visible:[box-shadow:var(--ring)]";

const TOC_LINK_CLASS =
  "flex min-h-[44px] items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] [font:var(--type-small)] outline-none transition-colors hover:text-[var(--cyan)] focus-visible:[box-shadow:var(--ring)]";

export function LessonArticle({
  lesson,
  sheetNumber = "4.x",
}: {
  lesson: Lesson;
  /** Datasheet coordinate for this lesson, e.g. "4.3" (position in the
   *  sorted order); drives the kicker, the numbered TOC, and the figure
   *  captions. Purely presentational — the lesson schema is untouched. */
  sheetNumber?: string;
}): JSX.Element {
  const toc = extractToc(lesson);
  // Editor blocks are the numbered figures: FIGURE 4.N.k in body order.
  const editorOrdinals = new Map<number, number>();
  lesson.body.forEach((block, index) => {
    if (block.type === "editor") editorOrdinals.set(index, editorOrdinals.size + 1);
  });
  // The opening paragraph of the first prose block carries the editorial serif
  // lead; every other paragraph keeps the body type. Found once so the per-block
  // map stays a pure switch.
  const firstProseIndex = lesson.body.findIndex((b) => b.type === "prose");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 lg:flex-row-reverse lg:items-start lg:gap-12">
      <nav
        aria-label="On this page"
        className="lg:sticky lg:top-24 lg:h-fit lg:w-56 lg:shrink-0"
      >
        <details
          open
          className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 lg:border-0 lg:bg-transparent lg:p-0"
        >
          <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] lg:list-none">
            on this sheet
          </summary>
          <ul className="mt-3 flex flex-col lg:mt-0">
            {toc.map((entry, i) => (
              <li key={i}>
                <a
                  href={`#${entry.id}`}
                  className={
                    entry.depth === 3
                      ? `${TOC_LINK_CLASS} pl-4`
                      : TOC_LINK_CLASS
                  }
                >
                  <span className="mr-2 font-mono text-[11px] text-[var(--text-tertiary)]">
                    {sheetNumber}.{i}
                  </span>
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </nav>

      <article className="w-full min-w-0 max-w-2xl">
        <DocRule section={`sheet ${sheetNumber} · ${lesson.slug}`} context="learn" className="mb-6" />
        <Kicker number={sheetNumber} title={lesson.title} className="mb-4" />
        <h1 className="mb-8 font-serif text-3xl font-semibold leading-tight text-[var(--text-primary)] sm:text-4xl">
          {lesson.title}
        </h1>

        {lesson.body.map((block, index) => {
          switch (block.type) {
            case "prose":
              return (
                <div
                  key={index}
                  className={
                    index === firstProseIndex
                      ? "[&_p:first-of-type]:[font:var(--type-lead)]"
                      : undefined
                  }
                >
                  <LessonMarkdown markdown={block.markdown} />
                </div>
              );
            case "code":
              return (
                <div key={index} className="my-6">
                  <CodeBlock
                    code={block.source}
                    language={block.language === "asm" ? "arm64" : block.language}
                  />
                  <Link
                    href={`/playground${buildShareHash({ source: block.source })}`}
                    className={OPEN_IN_PLAYGROUND_CLASS}
                  >
                    Open in playground
                    <span aria-hidden="true">-&gt;</span>
                  </Link>
                </div>
              );
            case "callout":
              return (
                <div key={index} className="my-6">
                  <Callout type={block.variant}>
                    <LessonMarkdown markdown={block.markdown} />
                  </Callout>
                </div>
              );
            case "editor":
              return (
                <div key={index} className="my-6">
                  {/* Fixed frame at every breakpoint (no shift as the editor
                      loads); the embed's container-driven layout gives the
                      editor the full prose measure above a registers |
                      console split. */}
                  <div className="flex h-[560px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)]">
                    <EmbeddablePlayground
                      chrome="embed"
                      startSource={block.starter}
                      startArgs={block.args}
                      startStdin={safeStdin(block.stdin)}
                      readOnly={false}
                    />
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      figure {sheetNumber}.{editorOrdinals.get(index)}
                      <span className="ml-2 font-serif normal-case italic tracking-normal text-[12px]">
                        runnable — step it and watch the registers
                      </span>
                    </span>
                    <Link
                      href={`/playground${buildShareHash({
                        source: block.starter,
                        args: block.args,
                        stdin: safeStdin(block.stdin),
                      })}`}
                      className={OPEN_IN_PLAYGROUND_CLASS}
                    >
                      Open in playground
                      <span aria-hidden="true">-&gt;</span>
                    </Link>
                  </div>
                </div>
              );
          }
        })}
      </article>
    </div>
  );
}
