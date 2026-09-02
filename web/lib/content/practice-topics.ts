/**
 * The practice sheet's two sides and its topic order, in one table.
 *
 * Every exercise is either a coding exercise (the emulator runs the
 * student's program and checks it) or a theory set (quizzes, fill-in-the-
 * blank drills, and mental traces graded on the page). The index shows
 * the two side by side, each grouped by topic in the order the course
 * meets them, so the table below is the single place that order lives.
 */

import type { Exercise } from "@/lib/content/exercise-schema";

export type PracticeSide = "code" | "theory";

export interface PracticeSideInfo {
  id: PracticeSide;
  /** Datasheet caption over the column. */
  caption: string;
  title: string;
  description: string;
}

export const PRACTICE_SIDES: readonly PracticeSideInfo[] = [
  {
    id: "code",
    caption: "code",
    title: "Coding exercises",
    description:
      "Write the program. The emulator runs it and checks the result, never a stored solution.",
  },
  {
    id: "theory",
    caption: "theory",
    title: "Theory sets",
    description: "Quizzes, fill-in-the-blank drills, and mental traces, graded on the page.",
  },
];

/** Which side an exercise belongs to, decided by how it is graded. */
export function practiceSide(exercise: Pick<Exercise, "variant">): PracticeSide {
  return exercise.variant === "write" || exercise.variant === "identify-bug" ? "code" : "theory";
}

/**
 * Topics in course order, with the label the index prints. A topic missing
 * from this table still renders (its id is the label) and sorts after
 * every listed one, so a new exercise file never disappears; it just asks
 * for a row here.
 */
export const PRACTICE_TOPICS: readonly { id: string; label: string }[] = [
  { id: "architecture", label: "system architecture" },
  { id: "binary-logic", label: "binary logic" },
  { id: "binary-arithmetic", label: "binary arithmetic" },
  { id: "armv8", label: "armv8 basics" },
  { id: "branching", label: "branching" },
  { id: "loops", label: "loops" },
  { id: "bitwise", label: "bitwise" },
  { id: "arrays", label: "arrays" },
  { id: "strings", label: "strings" },
  { id: "memory", label: "memory and the stack" },
  { id: "functions", label: "functions" },
  { id: "subroutines", label: "subroutines" },
  { id: "io", label: "input and output" },
  { id: "argv", label: "command-line arguments" },
  { id: "external-data", label: "external data" },
  { id: "floating-point", label: "floating point" },
];

const TOPIC_RANK = new Map(PRACTICE_TOPICS.map((topic, index) => [topic.id, index]));
const TOPIC_LABEL = new Map(PRACTICE_TOPICS.map((topic) => [topic.id, topic.label]));

/** Sort key for a topic id: table position, or after the table for an unlisted one. */
export function topicRank(id: string | undefined): number {
  if (id === undefined) return PRACTICE_TOPICS.length + 1;
  return TOPIC_RANK.get(id) ?? PRACTICE_TOPICS.length;
}

/** Printable label for a topic id; an unlisted id prints as itself. */
export function topicLabel(id: string): string {
  return TOPIC_LABEL.get(id) ?? id;
}
