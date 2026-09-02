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
import type { Lesson } from "@/lib/content/lesson-schema";
import { extractToc } from "@/lib/content/lesson-toc";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Callout } from "@/components/ui/Callout";
import { OpenInPlayground } from "@/components/ui/OpenInPlayground";
import { EmbeddablePlayground } from "@/components/playground/EmbeddablePlayground";
import { buildShareHash } from "@/lib/playground/share";
import { validateStdin } from "@/lib/playground/upload-guard";
import { DocRule } from "@/components/ui/DocRule";
import { Kicker } from "@/components/ui/Kicker";

/**
 * The author stdin only when it is present and within the stdin cap; otherwise
 * undefined, so an oversize input is dropped rather than seeded into the embed.
 */
function safeStdin(stdin: string | undefined): string | undefined {
  if (stdin === undefined) return undefined;
  return validateStdin(stdin) === null ? stdin : undefined;
}

const TOC_LINK_CLASS =
  "flex min-h-[44px] items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] [font:var(--type-small)] outline-none transition-colors hover:text-[var(--cyan)] focus-visible:[box-shadow:var(--ring)]";

export function LessonArticle({
  lesson,
  sheetNumber = "4.x",
}: {
  lesson: Lesson;
  /** Datasheet coordinate for this lesson, e.g. "4.3" (position in the
   *  sorted order); drives the kicker, the numbered TOC, and the figure
   *  captions. Purely presentational -- the lesson schema is untouched. */
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 lg:max-w-7xl lg:flex-row-reverse lg:items-start lg:gap-12">
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

      <article className="w-full min-w-0">
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
                      ? "max-w-2xl [&_p:first-of-type]:[font:var(--type-lead)]"
                      : "max-w-2xl"
                  }
                >
                  <LessonMarkdown markdown={block.markdown} />
                </div>
              );
            case "code": {
              // Only assembly runs in the playground; C and plain-text blocks
              // render without the hand-off (the emulator can't open them).
              const openable = block.language === "asm";
              return (
                <div key={index} className="my-6 max-w-2xl">
                  <CodeBlock
                    code={block.source}
                    language={block.language === "asm" ? "arm64" : block.language}
                  />
                  {openable && (
                    <OpenInPlayground
                      href={`/playground${buildShareHash({ source: block.source })}`}
                      className="mt-2"
                    />
                  )}
                </div>
              );
            }
            case "callout":
              return (
                <div key={index} className="my-6 max-w-2xl">
                  <Callout type={block.variant}>
                    <LessonMarkdown markdown={block.markdown} />
                  </Callout>
                </div>
              );
            case "editor":
              return (
                <div key={index} className="my-6">
                  {/* Fixed frame per breakpoint (no shift as the editor loads);
                      at lg the figure takes the whole article column, so the
                      editor sits beside the registers. */}
                  <div className="embed-frame flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[560px] lg:h-[680px]">
                    <EmbeddablePlayground
                      chrome="embed"
                      startSource={block.starter}
                      startArgs={block.args}
                      startStdin={safeStdin(block.stdin)}
                      readOnly={false}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      figure {sheetNumber}.{editorOrdinals.get(index)}
                      <span className="ml-2 font-serif normal-case italic tracking-normal text-[12px]">
                        runnable -- step it and watch the registers
                      </span>
                    </span>
                    <OpenInPlayground
                      href={`/playground${buildShareHash({
                        source: block.starter,
                        args: block.args,
                        stdin: safeStdin(block.stdin),
                      })}`}
                      className="mt-2"
                    />
                  </div>
                </div>
              );
          }
        })}
      </article>
    </div>
  );
}
