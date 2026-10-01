import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Lesson } from "@/lib/content/lesson-schema";
import type { ExerciseIndexRow } from "@/lib/content/exercise-schema";
import { lessonLinks } from "@/lib/content/lesson-links";
import { loadAllLessons } from "@/lib/content/lessons";
import { loadExerciseIndex } from "@/lib/content/exercises";
import { PRACTICE_TOPICS, practiceSide, type PracticeSide } from "@/lib/content/practice-topics";

// The foot of every lesson: the previous and next buttons follow the sorted
// lesson list, the last lesson hands over to practice, and the practice links
// are exactly the exercises the lesson's own text links to.

function lesson(slug: string, title: string, markdown = "No links here."): Lesson {
  return { title, slug, order: 1, body: [{ type: "prose", markdown }] };
}

function exercise(
  slug: string,
  variant: ExerciseIndexRow["variant"],
  difficulty?: ExerciseIndexRow["difficulty"],
): ExerciseIndexRow {
  return { title: `Title of ${slug}`, slug, order: 1, variant, difficulty, blurb: "" };
}

const THREE = [lesson("one", "One"), lesson("two", "Two"), lesson("three", "Three")];
const EXERCISES = [
  exercise("write-one", "write", "intro"),
  exercise("bug-one", "identify-bug"),
  exercise("quiz-one", "quiz", "core"),
  exercise("blanks-one", "blanks", "challenge"),
];

describe("lessonLinks neighbours", () => {
  it("gives the first lesson a next button and no previous one", () => {
    const links = lessonLinks(THREE, "one", EXERCISES);
    expect(links.number).toBe("4.1");
    expect(links.previous).toBeUndefined();
    expect(links.next).toEqual({ href: "/learn/two", number: "4.2", title: "Two" });
  });

  it("gives a middle lesson the lessons on either side", () => {
    const links = lessonLinks(THREE, "two", EXERCISES);
    expect(links.number).toBe("4.2");
    expect(links.previous).toEqual({ href: "/learn/one", number: "4.1", title: "One" });
    expect(links.next).toEqual({ href: "/learn/three", number: "4.3", title: "Three" });
  });

  it("points the last lesson's next button at practice", () => {
    const links = lessonLinks(THREE, "three", EXERCISES);
    expect(links.number).toBe("4.3");
    expect(links.previous).toEqual({ href: "/learn/two", number: "4.2", title: "Two" });
    expect(links.next).toEqual({ href: "/practice", number: "05", title: "Practice" });
  });

  it("follows the order it is given, so a reordered list moves the buttons", () => {
    const reordered = [THREE[2], THREE[0], THREE[1]];
    const links = lessonLinks(reordered, "one", EXERCISES);
    expect(links.number).toBe("4.2");
    expect(links.previous?.href).toBe("/learn/three");
    expect(links.next.href).toBe("/learn/two");
  });

  it("gives a lone lesson only the way to practice", () => {
    const links = lessonLinks([THREE[0]], "one", EXERCISES);
    expect(links.previous).toBeUndefined();
    expect(links.next.href).toBe("/practice");
  });

  it("throws for a slug that is not in the list", () => {
    expect(() => lessonLinks(THREE, "four", EXERCISES)).toThrow('no lesson "four"');
  });
});

describe("lessonLinks practice", () => {
  it("splits the linked exercises into coding and theory, first mention first, each once", () => {
    const text = [
      "Try [the quiz](/practice/quiz-one) and [the fix](/practice/bug-one).",
      "Then [write it](/practice/write-one), or [the quiz again](/practice/quiz-one).",
      "The [whole list](/practice) and [another lesson](/learn/two) are not exercises.",
    ].join("\n");
    const links = lessonLinks([lesson("one", "One", text)], "one", EXERCISES);
    expect(links.practice).toHaveLength(2);
    expect(links.practice[0].side.id).toBe("code");
    expect(links.practice[0].links).toEqual([
      { href: "/practice/bug-one", title: "Title of bug-one", difficulty: undefined },
      { href: "/practice/write-one", title: "Title of write-one", difficulty: "intro" },
    ]);
    expect(links.practice[1].side.id).toBe("theory");
    expect(links.practice[1].links).toEqual([
      { href: "/practice/quiz-one", title: "Title of quiz-one", difficulty: "core" },
    ]);
  });

  it("reads callouts and skips code listings", () => {
    const withCallout: Lesson = {
      title: "One",
      slug: "one",
      order: 1,
      body: [
        { type: "code", language: "text", source: "[not a link](/practice/missing)" },
        { type: "callout", variant: "note", markdown: "See [blanks](/practice/blanks-one)." },
      ],
    };
    const links = lessonLinks([withCallout], "one", EXERCISES);
    expect(links.practice).toHaveLength(1);
    expect(links.practice[0].side.id).toBe("theory");
    expect(links.practice[0].links.map((link) => link.href)).toEqual(["/practice/blanks-one"]);
  });

  it("is empty for a lesson that links no exercise", () => {
    expect(lessonLinks(THREE, "two", EXERCISES).practice).toEqual([]);
  });

  it("throws when a lesson links an exercise that does not exist", () => {
    const broken = lesson("one", "One", "Try [this](/practice/missing).");
    expect(() => lessonLinks([broken], "one", EXERCISES)).toThrow(
      'lesson "one" links /practice/missing, which is not an exercise',
    );
  });
});

// The shipped lessons, read once. The expected targets come from the
// folders on disk, not from the loaders.
const lessons = loadAllLessons();
const exercises = loadExerciseIndex();
const lessonSlugs = new Set(
  fs.readdirSync(path.join(process.cwd(), "content/lessons"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length)),
);
const exerciseSlugs = new Set(
  fs.readdirSync(path.join(process.cwd(), "content/exercises"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length)),
);

describe("lessonLinks on the shipped lessons", () => {
  it("chains every lesson to the next one in order and ends at practice", () => {
    expect(lessons.length).toBeGreaterThan(2);
    lessons.forEach((entry, index) => {
      const links = lessonLinks(lessons, entry.slug, exercises);
      expect(links.number).toBe(`4.${index + 1}`);
      expect(links.previous?.href).toBe(index === 0 ? undefined : `/learn/${lessons[index - 1].slug}`);
      const last = index === lessons.length - 1;
      expect(links.next.href).toBe(last ? "/practice" : `/learn/${lessons[index + 1].slug}`);
    });
  });

  it("links only to pages that exist", () => {
    for (const entry of lessons) {
      const links = lessonLinks(lessons, entry.slug, exercises);
      for (const neighbour of [links.previous, links.next]) {
        if (!neighbour || neighbour.href === "/practice") continue;
        expect(lessonSlugs).toContain(neighbour.href.replace("/learn/", ""));
      }
      for (const group of links.practice) {
        for (const link of group.links) {
          expect(exerciseSlugs).toContain(link.href.replace("/practice/", ""));
        }
      }
    }
  });

  // The foot card shows each exercise's title and difficulty, so the lesson
  // text may name a linked exercise by its title, its title with the
  // difficulty in brackets, or the difficulty alone after a named sibling.
  // A title the exercise no longer carries fails here.
  it("names every linked exercise the way its foot card does", () => {
    const bySlug = new Map(exercises.map((row) => [row.slug, row]));
    const stale: string[] = [];
    for (const entry of lessons) {
      for (const block of entry.body) {
        if (block.type !== "prose" && block.type !== "callout") continue;
        for (const [link, text, slug] of block.markdown.matchAll(/\[([^\]]+)\]\(\/practice\/([^)\s#?]+)/g)) {
          const row = bySlug.get(slug);
          const names = row?.difficulty
            ? [row.title, `${row.title} (${row.difficulty})`, row.difficulty]
            : [row?.title];
          if (!names.includes(text)) stale.push(`${entry.slug}: ${link})`);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});

// Topics that ship one side only, each with the reason the other side does
// not fit. An entry whose topic gains that side fails, so the list stays true.
const ONE_SIDED: Record<string, { missing: PracticeSide; why: string }> = {
  architecture: {
    missing: "code",
    why: "buses, memory and the fetch-execute cycle are described, not programmed",
  },
  "binary-logic": {
    missing: "code",
    why: "truth tables and gates are worked by hand; the programs that use them sit under bitwise",
  },
};

describe("practice coverage", () => {
  it("gives every lesson at least one coding exercise and one theory set", () => {
    const short: string[] = [];
    for (const entry of lessons) {
      const sides = lessonLinks(lessons, entry.slug, exercises).practice.map((group) => group.side.id);
      for (const side of ["code", "theory"] as const) {
        if (!sides.includes(side)) short.push(`${entry.slug} links no ${side} exercise`);
      }
    }
    expect(short).toEqual([]);
  });

  it("gives every topic on the practice page both sides, apart from the listed exceptions", () => {
    const topics = new Set([
      ...PRACTICE_TOPICS.map((topic) => topic.id),
      ...exercises.flatMap((row) => (row.topic ? [row.topic] : [])),
    ]);
    const short: string[] = [];
    for (const topic of topics) {
      const sides = new Set(exercises.filter((row) => row.topic === topic).map(practiceSide));
      const expected = (["code", "theory"] as const).filter((side) => side !== ONE_SIDED[topic]?.missing);
      for (const side of expected) {
        if (!sides.has(side)) short.push(`${topic} has no ${side} exercise`);
      }
      const exception = ONE_SIDED[topic];
      if (exception && sides.has(exception.missing)) {
        short.push(`${topic} now has a ${exception.missing} exercise; drop it from ONE_SIDED`);
      }
    }
    expect(short).toEqual([]);
  });
});
