/**
 * Where the end of a lesson leads: the exercises its text links to, and the
 * lessons either side of it. The neighbours come from the sorted lesson list
 * and the exercises from the lesson's own markdown, so reordering lessons or
 * editing a lesson's practice list moves these links with it.
 */

import type { Lesson } from "@/lib/content/lesson-schema";
import type { ExerciseDifficulty, ExerciseIndexRow } from "@/lib/content/exercise-schema";
import { PRACTICE_SIDES, practiceSide, type PracticeSideInfo } from "@/lib/content/practice-topics";

/** One of the two buttons at the foot of a lesson. */
export interface NeighbourLink {
  href: string;
  /** The sheet number it shows, "4.N" for a lesson. */
  number: string;
  title: string;
}

export interface PracticeLink {
  href: string;
  title: string;
  difficulty?: ExerciseDifficulty;
}

/** The exercises on one side of the practice page, in the order the lesson mentions them. */
export interface PracticeGroup {
  side: PracticeSideInfo;
  links: PracticeLink[];
}

export interface LessonLinks {
  /** This lesson's sheet number. */
  number: string;
  previous?: NeighbourLink;
  next: NeighbourLink;
  /** Only the sides the lesson links to, coding exercises first. */
  practice: PracticeGroup[];
}

/** The last lesson's next button. 05 is the number the practice page's kicker carries. */
export const AFTER_LAST_LESSON: NeighbourLink = { href: "/practice", number: "05", title: "Practice" };

/** The slug in a markdown link to an exercise page, `](/practice/<slug>)`. */
const PRACTICE_LINK = /\]\(\/practice\/([^)\s#?]+)/g;

function lessonNumber(position: number): string {
  return `4.${position + 1}`;
}

/**
 * The end-of-lesson links for `slug`. `lessons` must be in reading order, as
 * loadAllLessons returns them. Throws when the slug is not a lesson, or when
 * the lesson links an exercise that does not exist, so a typo fails the build
 * instead of shipping a dead link.
 */
export function lessonLinks(
  lessons: Lesson[],
  slug: string,
  exercises: ExerciseIndexRow[],
): LessonLinks {
  const position = lessons.findIndex((lesson) => lesson.slug === slug);
  if (position === -1) throw new Error(`no lesson "${slug}"`);

  const neighbour = (index: number): NeighbourLink => ({
    href: `/learn/${lessons[index].slug}`,
    number: lessonNumber(index),
    title: lessons[index].title,
  });

  const bySlug = new Map(exercises.map((exercise) => [exercise.slug, exercise]));
  const linked = new Map<string, ExerciseIndexRow>();
  for (const block of lessons[position].body) {
    if (block.type !== "prose" && block.type !== "callout") continue;
    for (const [, target] of block.markdown.matchAll(PRACTICE_LINK)) {
      const exercise = bySlug.get(target);
      if (!exercise) {
        throw new Error(`lesson "${slug}" links /practice/${target}, which is not an exercise`);
      }
      linked.set(target, exercise);
    }
  }

  const practice = PRACTICE_SIDES.map((side) => ({
    side,
    links: [...linked.values()]
      .filter((exercise) => practiceSide(exercise) === side.id)
      .map((exercise) => ({
        href: `/practice/${exercise.slug}`,
        title: exercise.title,
        difficulty: exercise.difficulty,
      })),
  })).filter((group) => group.links.length > 0);

  return {
    number: lessonNumber(position),
    previous: position > 0 ? neighbour(position - 1) : undefined,
    next: position < lessons.length - 1 ? neighbour(position + 1) : AFTER_LAST_LESSON,
    practice,
  };
}
