"use client";

/**
 * One lesson as an article with a table of contents. All author Markdown goes
 * through LessonMarkdown, the one sanitizing renderer, so there is no raw-HTML
 * path. Editor stdin is checked here so an oversize input never reaches the
 * worker, and the toc comes from the same extractToc that ids the headings, so
 * the anchors always match.
 */

import type { JSX, ReactNode } from "react";
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
import { OnThisPage } from "@/components/ui/OnThisPage";

function safeStdin(stdin: string | undefined): string | undefined {
  if (stdin === undefined) return undefined;
  return validateStdin(stdin) === null ? stdin : undefined;
}

/** A `main:` label at the start of a line, the mark of a complete program. */
const DEFINES_MAIN = /^[ \t]*main:/m;

/** The lead line of the note that answers a lesson's Check yourself. */
const ANSWERS_LEAD = "Answers:";
const ANSWERS_SUMMARY =
  "cursor-pointer font-medium leading-[44px] text-[var(--cyan)] outline-none hover:underline focus-visible:[box-shadow:var(--ring)]";

export function LessonArticle({
  lesson,
  sheetNumber = "4.x",
  children,
}: {
  lesson: Lesson;
  /** The lesson's number, e.g. "4.3" (its place in the sorted order); it
   *  numbers the kicker and the contents. */
  sheetNumber?: string;
  /** The foot of the article, after the last block. A slot rather than a
   *  prop of data, so the page can render it on the server. */
  children?: ReactNode;
}): JSX.Element {
  const toc = extractToc(lesson);
  // Editor blocks are examples 1, 2, 3 in body order. The 4.N.k numbers
  // belong to the contents: one number naming a section and an example
  // was ambiguous.
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
      <OnThisPage
        sections={toc.map((entry, i) => ({
          id: entry.id,
          label: entry.text,
          number: `${sheetNumber}.${i + 1}`,
          depth: entry.depth,
        }))}
        className="lg:w-56 lg:shrink-0"
      />

      <article className="w-full min-w-0">
        <DocRule section={`lesson ${sheetNumber} · ${lesson.title}`} context="learn" className="mb-6" />
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
                  // At 19px a 320px phone set the lead 27 characters to a
                  // line; 17px there reads closer to the body's measure.
                  className={
                    index === firstProseIndex
                      ? "max-w-2xl [&_p:first-of-type]:[font:var(--type-lead)] max-sm:[&_p:first-of-type]:text-[17px]"
                      : "max-w-2xl"
                  }
                >
                  <LessonMarkdown markdown={block.markdown} />
                </div>
              );
            case "code": {
              // Only a whole assembly program opens: C and text cannot run,
              // and a fragment with no main of its own refuses to link.
              const openable = block.language === "asm" && DEFINES_MAIN.test(block.source);
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
            case "callout": {
              // Open, the answers sat right under the questions and the eye
              // read them first; folded, the reader answers, then looks.
              const answers = block.markdown.startsWith(ANSWERS_LEAD);
              return (
                <div key={index} className="my-6 max-w-2xl">
                  <Callout type={block.variant} label={answers ? "answers" : undefined}>
                    {answers ? (
                      // The marker and the expanded state the browser reports
                      // say open or shut, so the label stays put.
                      <details>
                        <summary className={ANSWERS_SUMMARY}>show answers</summary>
                        <LessonMarkdown markdown={block.markdown.slice(ANSWERS_LEAD.length)} />
                      </details>
                    ) : (
                      <LessonMarkdown markdown={block.markdown} />
                    )}
                  </Callout>
                </div>
              );
            }
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
                      registerHeadingLevel={3}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      example {editorOrdinals.get(index)}
                      <span className="ml-2 font-serif normal-case italic tracking-normal text-[12px]">
                        try it: run it, or step one instruction at a time
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
        {children}
      </article>
    </div>
  );
}
