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

export function LessonArticle({ lesson }: { lesson: Lesson }): JSX.Element {
  const toc = extractToc(lesson);
  // The first prose block carries the editorial serif lead; later prose use
  // body type. Found once so the per-block map stays a pure switch.
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
          <summary className="cursor-pointer select-none text-[var(--text-secondary)] [font:var(--type-small)] lg:hidden">
            On this page
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
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </nav>

      <article className="w-full min-w-0 max-w-2xl">
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
                      ? "[&_p]:[font:var(--type-lead)]"
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
                <div
                  key={index}
                  className="my-6 flex h-[440px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] sm:h-[520px]"
                >
                  <EmbeddablePlayground
                    chrome="embed"
                    startSource={block.starter}
                    startArgs={block.args}
                    startStdin={safeStdin(block.stdin)}
                    readOnly={false}
                  />
                </div>
              );
          }
        })}
      </article>
    </div>
  );
}
