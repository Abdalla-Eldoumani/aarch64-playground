import { describe, expect, it } from "vitest";
import {
  CALLING_CONVENTION,
  PITFALLS,
  PITFALL_GROUPS,
  referenceHref,
} from "@/lib/content/pitfall-data";
import { REFERENCE_INSTRUCTIONS } from "@/lib/content/reference-data";
import { loadAllLessons } from "@/lib/content/lessons";
import { pitfallFragment } from "@/lib/content/site";

// The contract every card keeps: both programs with what the course server
// did with them, a source, a group, and links that resolve, with the lesson
// it names linking back to it.
const LESSONS = loadAllLessons();
const LESSON_SLUGS = new Set(LESSONS.map((lesson) => lesson.slug));
const MNEMONICS = new Set(REFERENCE_INSTRUCTIONS.map((entry) => entry.mnemonic));
const GROUP_IDS = new Set(PITFALL_GROUPS.map((group) => group.id));

/** Every /reference#pitfall-<slug> link in a lesson's prose and callouts. */
function pitfallLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(\/reference#pitfall-([a-z0-9-]+)\)/g)].map((m) => m[1]);
}

const LESSON_TEXT = new Map(
  LESSONS.map((lesson) => [
    lesson.slug,
    lesson.body
      .map((block) => (block.type === "prose" || block.type === "callout" ? block.markdown : ""))
      .join("\n"),
  ]),
);

describe("pitfall cards", () => {
  it("number at least 28, each with a unique url-safe slug", () => {
    expect(PITFALLS.length).toBeGreaterThanOrEqual(28);
    const slugs = PITFALLS.map((pitfall) => pitfall.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("each carry a broken and a fixed program with the server's result", () => {
    for (const { slug, broken, fixed } of PITFALLS) {
      for (const run of [broken, fixed]) {
        expect(run.source, slug).toMatch(/^main:$/m);
        expect(run.source, slug).toMatch(/\.global\s+main/);
        expect(typeof run.stdout, slug).toBe("string");
        expect(Object.keys(run.ends), slug).toHaveLength(1);
      }
      expect(broken.source, slug).not.toBe(fixed.source);
    }
  });

  it("each name the mistake, both outcomes, and the fix", () => {
    for (const pitfall of PITFALLS) {
      for (const field of ["title", "mistake", "server", "playground", "fix", "wrong", "right"] as const) {
        expect(pitfall[field].trim(), `${pitfall.slug}.${field}`).not.toBe("");
      }
    }
  });

  it("each cite a source in the Arm ARM, the GNU as manual, or AAPCS64", () => {
    for (const { slug, source } of PITFALLS) {
      expect(source.title, slug).toMatch(/^(Arm |GNU as manual|AAPCS64)/);
      expect(source.href, slug).toMatch(
        /^https:\/\/(developer\.arm\.com\/documentation\/ddi0(487|602)\/|sourceware\.org\/binutils\/docs\/as\/|github\.com\/ARM-software\/abi-aa\/blob\/[^/]+\/aapcs64\/)/,
      );
    }
  });

  it("each sit in a known group, and every group has a card", () => {
    for (const { slug, group } of PITFALLS) expect(GROUP_IDS.has(group), slug).toBe(true);
    for (const id of GROUP_IDS) {
      expect(PITFALLS.some((pitfall) => pitfall.group === id), id).toBe(true);
    }
  });

  it("each link to a lesson that exists and an entry the reference has", () => {
    for (const { slug, lesson, reference } of PITFALLS) {
      expect(LESSON_SLUGS.has(lesson), `${slug}: lesson ${lesson}`).toBe(true);
      expect(
        reference === CALLING_CONVENTION || MNEMONICS.has(reference),
        `${slug}: reference ${reference}`,
      ).toBe(true);
    }
  });

  it("send the reference link to the entry's own fragment", () => {
    expect(referenceHref("b.cond")).toBe("/reference#b-cond");
    expect(referenceHref("cmp")).toBe("/reference#cmp");
    expect(referenceHref(CALLING_CONVENTION)).toBe("/reference#calling-convention");
  });
});

describe("lessons and pitfall cards link both ways", () => {
  it("the lesson a card names links back to that card", () => {
    for (const { slug, lesson } of PITFALLS) {
      expect(pitfallLinks(LESSON_TEXT.get(lesson) ?? ""), `${lesson} -> ${slug}`).toContain(slug);
    }
  });

  it("every pitfall link in a lesson names a card that names that lesson", () => {
    const bySlug = new Map(PITFALLS.map((pitfall) => [pitfall.slug, pitfall]));
    for (const [lesson, text] of LESSON_TEXT) {
      for (const slug of pitfallLinks(text)) {
        expect(bySlug.has(slug), `${lesson} links to a missing card ${slug}`).toBe(true);
        expect(bySlug.get(slug)?.lesson, `${lesson} -> ${slug}`).toBe(lesson);
      }
    }
  });

  it("the card fragment is the one the links use", () => {
    expect(pitfallFragment("there-is-no-x31")).toBe("pitfall-there-is-no-x31");
  });
});
