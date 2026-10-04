/**
 * Which reference instructions the course's own programs use, worked out at
 * build time from the programs the site carries: lesson editors and asm code
 * blocks, the example programs, the exercises' reference solutions, and the
 * pitfall programs. Reading the sources on every build means the list cannot
 * drift from them. Importing node:fs keeps it server-only, as in lessons.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { loadAllLessons } from "@/lib/content/lessons";
import { PITFALLS } from "@/lib/content/pitfall-data";

// Strings, character literals and comments, matched left to right so a `//`
// inside a string or a quote inside a comment is read as what it sits in.
const NOT_CODE = /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\/.*$/gm;
const LABELS = /^\s*(?:[A-Za-z_.$][\w.$]*:\s*)+/;
const FIRST_WORD = /^\s*([A-Za-z][\w.]*)/;

/** The lowercase first word of every statement in an assembly program, with
 *  each condition form (b.eq, b.lt, ...) read as b.cond, the reference's name
 *  for them. Directives, m4 lines and labels give nothing a reference row has. */
export function mnemonicsIn(source: string): Set<string> {
  const found = new Set<string>();
  const code = source.replace(NOT_CODE, " ");
  for (const statement of code.split(/[\n;]/)) {
    const word = FIRST_WORD.exec(statement.replace(LABELS, ""))?.[1]?.toLowerCase();
    if (word) found.add(word.startsWith("b.") ? "b.cond" : word);
  }
  return found;
}

function assemblyFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".s"))
    .map((name) => fs.readFileSync(path.join(dir, name), "utf8"));
}

/** Every program the course ships, as source text. `root` is web/. */
export function coursePrograms(root: string = process.cwd()): string[] {
  const lessons = loadAllLessons(path.join(root, "content/lessons")).flatMap((lesson) =>
    lesson.body.flatMap((block) => {
      if (block.type === "editor") return [block.starter];
      if (block.type === "code" && block.language === "asm") return [block.source];
      return [];
    }),
  );
  const pitfalls = PITFALLS.flatMap((pitfall) => [pitfall.broken.source, pitfall.fixed.source]);
  return [
    ...lessons,
    ...assemblyFiles(path.join(root, "public/examples")),
    // The solutions live beside their tests and never ship; only the names of
    // the instructions they use leave this function.
    ...assemblyFiles(path.join(root, "lib/test/content/exercise-solutions")),
    ...pitfalls,
  ];
}

/** The mnemonics of `known` (the reference rows) that some course program
 *  uses, in the order `known` lists them. */
export function courseMnemonics(known: readonly string[], programs = coursePrograms()): string[] {
  const used = new Set<string>();
  for (const program of programs) for (const word of mnemonicsIn(program)) used.add(word);
  return known.filter((mnemonic) => used.has(mnemonic));
}
