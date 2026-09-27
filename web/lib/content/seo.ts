/**
 * What search engines and link previews read about each page: the title,
 * the snippet, the canonical address, the share card, and the structured
 * data. Every route builds these here, so the site name, the length limits,
 * and the https origin each have one source.
 */

import type { Metadata } from "next";
import type { Lesson } from "@/lib/content/lesson-schema";
import type { Exercise } from "@/lib/content/exercise-schema";
import { practiceSide, topicLabel } from "@/lib/content/practice-topics";
import { SHARE_CARD_IMAGE, SITE_NAME, SITE_URL } from "@/lib/content/site";

/** About where Google cuts a result's title and its snippet. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/**
 * The page title with the site name after it when both fit. A long title
 * keeps only its own words: those are what tell one lesson from the next
 * in a list of results.
 */
export function composeTitle(title: string): string {
  return title.length + TITLE_SUFFIX.length <= TITLE_MAX ? title + TITLE_SUFFIX : title;
}

/** Cut to the snippet limit at a word break, and mark the cut. */
export function clipDescription(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= DESCRIPTION_MAX) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}...`;
}

// Stand-ins for the punctuation inside inline code, so `XOX.OX.O.` or
// `QUIET!` never reads as the end of a sentence.
const CODE_PUNCTUATION = ".!?:";
const STAND_INS = "\uE000\uE001\uE002\uE003";

/** Inline Markdown down to the words a snippet shows. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*{1,2}([^*\s][^*]*?)\*{1,2}/g, "$1")
    .replace(/`([^`]*)`/g, (_, code: string) =>
      code.replace(/[.!?:]/g, (mark) => STAND_INS[CODE_PUNCTUATION.indexOf(mark)]),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Lines that are not running prose: headings, lists, tables, quotes, indented code. */
const NOT_PROSE = /^\s*(#{1,6} |[-*+] |\d+\. |\||>)|^ {4}/;

/** A sentence about the starter program rather than the task. */
const STARTER = /^The starter\b/;

/** A task that leans on the sentence before it, as in "Print its magnitude". */
const POINTS_BACK = /^(\S+ ){0,2}(it|its|them|they)\b/i;

/** A starter's register alias, such as sum_r: a name the reader has not met yet. */
const REGISTER_ALIAS = /\b\w+_r\b/;

/**
 * A snippet from authored Markdown: its prose, in whole sentences while they
 * fit. Headings, lists, tables, and code are skipped, and so is a later
 * sentence that ends in a colon (it introduces one of them) or describes the
 * starter. The opening states the task, so it stays even as a lead-in; an
 * opening about the starter stays only when the next sentence points back
 * to it. A sentence naming a register alias is skipped while other prose
 * remains. When whole sentences come out short, the prose is clipped at a
 * word instead.
 */
export function snippetFromMarkdown(markdown: string): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of [...markdown.split("\n"), ""]) {
    const fence = /^\s*```/.test(line);
    if (fence) inFence = !inFence;
    if (fence || inFence || NOT_PROSE.test(line) || line.trim() === "") {
      if (current.length > 0) paragraphs.push(plainText(current.join(" ")));
      current = [];
    } else {
      current.push(line);
    }
  }
  const [opening = "", ...later] = paragraphs.flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/));
  const keepOpening = !STARTER.test(opening) || POINTS_BACK.test(later[0] ?? "");
  const kept = [
    ...(keepOpening ? [opening] : []),
    ...later.filter((sentence) => !sentence.endsWith(":") && !STARTER.test(sentence)),
  ];
  const taught = kept.filter((sentence) => !REGISTER_ALIAS.test(sentence));
  // An opening lead-in reads as a statement once its list is gone.
  const sentences = (taught.length > 0 ? taught : [opening, ...later]).map((sentence) =>
    sentence.replace(/:$/, "."),
  );
  const prose = sentences.join(" ");
  let snippet = "";
  for (const sentence of sentences) {
    const next = snippet ? `${snippet} ${sentence}` : sentence;
    if (next.length > DESCRIPTION_MAX) break;
    snippet = next;
  }
  // A starter opening alone says nothing of the task, so cut into the task too.
  const thin = snippet.length < 100 || (snippet === opening && STARTER.test(opening));
  if (thin && prose.length > snippet.length) snippet = clipDescription(prose);
  return snippet.replace(/[\uE000-\uE003]/g, (mark) => CODE_PUNCTUATION[STAND_INS.indexOf(mark)]);
}

/** A lesson's snippet: its authored summary, or else its opening prose. */
export function lessonDescription(lesson: Lesson): string {
  if (lesson.summary) return clipDescription(lesson.summary);
  const opening = lesson.body.find((block) => block.type === "prose");
  return snippetFromMarkdown(opening?.type === "prose" ? opening.markdown : lesson.title);
}

/**
 * An exercise's snippet: the opening of its prompt. The authoring guide asks
 * a prompt to open with the task, so the snippet says what the reader does.
 */
export function exerciseDescription(exercise: Exercise): string {
  return snippetFromMarkdown(exercise.prompt);
}

interface PageCopy {
  /** The page's own title; the site name joins it when it fits. */
  title: string;
  description: string;
  /** The route's path, its canonical address. Omitted only by the 404. */
  path?: string;
  type?: "website" | "article";
}

/**
 * A route's metadata. Open Graph and Twitter cards do not merge across
 * route segments, so each route restates the whole card; relative paths
 * resolve against the root layout's metadataBase (the https origin).
 */
export function pageMetadata({ title, description, path, type = "website" }: PageCopy): Metadata {
  const fullTitle = composeTitle(title);
  return {
    title: { absolute: fullTitle },
    description,
    // null, not undefined: alternates inherit from the root layout, so a
    // page without an address would otherwise claim the home page's.
    alternates: path ? { canonical: path } : null,
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      ...(path ? { url: path } : {}),
      images: [SHARE_CARD_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [SHARE_CARD_IMAGE],
    },
  };
}

type JsonLdNode = Record<string, unknown>;

/** An absolute https address on the site. */
function siteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

const SITE_REF: JsonLdNode = { "@type": "WebSite", name: SITE_NAME, url: siteUrl("/") };

/** One payload per page: the schema.org context around the page's entries. */
export function jsonLdGraph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * JSON for an ld+json script element. JSON.stringify leaves "<" alone, and
 * a "</script>" inside an authored title would end the element early.
 */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** The site itself, for the home page: Google reads the site's name from it. */
export function websiteNode(description: string): JsonLdNode {
  return { ...SITE_REF, description, inLanguage: "en" };
}

/** The emulator as an app, for /playground. */
export function applicationNode(description: string): JsonLdNode {
  return {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: siteUrl("/playground"),
    description,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript and WebAssembly",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: 0, priceCurrency: "CAD" },
    audience: { "@type": "EducationalAudience", educationalRole: "student" },
    isPartOf: SITE_REF,
  };
}

function breadcrumbNode(section: { name: string; path: string }, page: { name: string; path: string }): JsonLdNode {
  const trail = [{ name: "Home", path: "/" }, section, page];
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: siteUrl(step.path),
    })),
  };
}

function learningResourceNode(
  fields: { name: string; description: string; path: string; type: string; lastUpdated?: string },
): JsonLdNode {
  return {
    "@type": "LearningResource",
    name: fields.name,
    description: fields.description,
    url: siteUrl(fields.path),
    learningResourceType: fields.type,
    educationalLevel: "undergraduate",
    inLanguage: "en",
    isAccessibleForFree: true,
    ...(fields.lastUpdated ? { dateModified: fields.lastUpdated } : {}),
    isPartOf: SITE_REF,
  };
}

/** A lesson page's entries: the lesson and the trail to it. */
export function lessonNodes(lesson: Lesson): JsonLdNode[] {
  const path = `/learn/${lesson.slug}`;
  return [
    learningResourceNode({
      name: lesson.title,
      description: lessonDescription(lesson),
      path,
      type: "lesson",
      lastUpdated: lesson.lastUpdated,
    }),
    breadcrumbNode({ name: "Learn", path: "/learn" }, { name: lesson.title, path }),
  ];
}

/**
 * An exercise page's entries. The theory sets are marked as quizzes through
 * learningResourceType rather than the Quiz type: Google reads Quiz only as
 * flashcards, and these are multiple choice, predictions, and blanks.
 */
export function exerciseNodes(exercise: Exercise): JsonLdNode[] {
  const path = `/practice/${exercise.slug}`;
  const resource = learningResourceNode({
    name: exercise.title,
    description: exerciseDescription(exercise),
    path,
    type: practiceSide(exercise) === "code" ? "exercise" : "quiz",
    lastUpdated: exercise.lastUpdated,
  });
  if (exercise.topic) resource.about = { "@type": "Thing", name: topicLabel(exercise.topic) };
  return [resource, breadcrumbNode({ name: "Practice", path: "/practice" }, { name: exercise.title, path })];
}
