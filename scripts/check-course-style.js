#!/usr/bin/env node
/*
 * Holds the programs the site ships to two layout rules of the course's
 * files: `.balign 4` on the line before every `.global` that exports code,
 * and addresses loaded with `ldr xN, =label`, never an `adrp` / `add` pair.
 * The directive names course files never write are a content test's job
 * (web/lib/test/content/course-style.test.ts).
 *
 *   node scripts/check-course-style.js
 *
 * Exits 0 when every program follows both rules, 1 with one line per break.
 * Runs on node alone: TypeScript sources are read as text, line by line, so
 * a program squeezed into a one-line string with \n escapes goes unseen.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// The terminal games under examples/ are copies of their own repositories
// (examples/cpsc355/README.md), so a fix lands upstream first. Each rule
// skips only the ones that break it today; two-sum and temp-convert follow both.
const UPSTREAM = {
  balign: /^web\/public\/examples\/cpsc355\/(snake|calc|dsav|deadzone|flappy)(\.s$|\/)/,
  adrp: /^web\/public\/examples\/cpsc355\/deadzone(\.s$|\/)/,
};
// Each entry is a folder (read recursively) or a file, and the ending of the
// files it holds programs in.
const SOURCES = [
  ["web/public/examples", ".s"],
  ["web/lib/test/content/exercise-solutions", ".s"],
  ["web/content/lessons", ".json"],
  ["web/content/exercises", ".json"],
  ["web/lib/content/pitfalls", ".ts"],
  ["web/lib/content/reference-data.ts", ".ts"],
  ["web/lib/content/calling-convention-examples.ts", ".ts"],
  ["web/lib/content/landing-content.ts", ".ts"],
  ["web/lib/playground/playground-source.ts", ".ts"],
  ["docs/authoring-content.md", ".md"],
];

// Breaks that teach the rule or predate this check, each pinned to its exact
// count so a new break in the same file still fails, and a fixed one asks
// for its entry to go.
const KNOWN = {
  // The external-data lesson, the adrp pitfall and the adrp reference entry
  // teach the pair gcc writes.
  "web/content/lessons/external-data.json": { adrp: 1 },
  "web/lib/content/pitfalls/registers.ts": { adrp: 4 },
  "web/lib/content/reference-data.ts": { adrp: 1 },
  // wrapInMain's one-instruction wrapper for the reference's playground links.
  "web/lib/playground/playground-source.ts": { balign: 1 },
};

const RULES = {
  balign: "put `.balign 4` on the line before `.global`: course files align each function they export",
  adrp: "load the address with `ldr xN, =label`, the course's form, not an `adrp` / `add` pair",
};

// A whole line, or the rest of a line after the backtick that opens a
// template literal. Requiring the line to end after the operands keeps
// prose that mentions a directive (a markdown table, a quiz option) out.
const START = "(?:^|`)\\s*";
const END = "\\s*(?://.*)?$";
const GLOBAL = new RegExp(`${START}\\.global\\s+([A-Za-z_.$][\\w.$]*)${END}`);
const BALIGN = new RegExp(`${START}\\.balign\\s+4${END}`);
const ADRP = new RegExp(`${START}(?:[A-Za-z_.$][\\w.$]*:\\s*)?adrp\\s+x\\d{1,2}\\s*,\\s*[A-Za-z_.$][\\w.$]*${END}`, "i");
const BLANK = /^\s*(?:\/\/.*)?$/;
const DATA = /^\s*[A-Za-z_.$][\w.$]*:\s*\.(?:byte|hword|word|dword|string|ascii|asciz|skip|double|single|float)\b/;

/** Each rule break in one program text, as { line, rule }. */
function breaks(text) {
  const lines = text.split(/\r?\n/);
  const found = [];
  const codeLine = (from, step) => {
    let i = from;
    while (i >= 0 && i < lines.length && BLANK.test(lines[i])) i += step;
    return lines[i] ?? "";
  };
  lines.forEach((line, i) => {
    if (ADRP.test(line)) found.push({ line: i + 1, rule: "adrp" });
    const global = GLOBAL.exec(line);
    if (!global) return;
    // A data label carries its own alignment; only code needs the 4.
    const next = codeLine(i + 1, 1);
    if (DATA.test(next) && next.trimStart().startsWith(`${global[1]}:`)) return;
    if (!BALIGN.test(codeLine(i - 1, -1))) found.push({ line: i + 1, rule: "balign" });
  });
  return found;
}

/** Every string inside a parsed JSON value, depth first. */
function strings(value) {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Each program text in one file: a JSON file's strings, any other file whole. */
function texts(file) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  return file.endsWith(".json") ? strings(JSON.parse(raw)) : [raw];
}

function filesUnder(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.statSync(full).isDirectory()) return [rel];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => filesUnder(`${rel}/${entry.name}`));
}

/** Every break in the tree that KNOWN does not account for, as printable lines. */
function check() {
  const problems = [];
  const files = SOURCES.flatMap(([rel, ending]) => filesUnder(rel).filter((file) => file.endsWith(ending)));
  for (const file of files) {
    const counts = { balign: 0, adrp: 0 };
    const lines = [];
    for (const text of texts(file)) {
      for (const hit of breaks(text).filter((h) => !UPSTREAM[h.rule].test(file))) {
        counts[hit.rule] += 1;
        lines.push(`${file}:${hit.line}: ${RULES[hit.rule]}`);
      }
    }
    const known = KNOWN[file] ?? {};
    for (const rule of Object.keys(counts)) {
      const allowed = known[rule] ?? 0;
      if (counts[rule] > allowed) problems.push(...lines.filter((l) => l.endsWith(RULES[rule])));
      else if (counts[rule] < allowed) {
        problems.push(`${file}: ${allowed} known ${rule} breaks, ${counts[rule]} found; lower its entry in KNOWN`);
      }
    }
  }
  for (const file of Object.keys(KNOWN)) {
    if (!files.includes(file)) problems.push(`${file}: listed in KNOWN but not scanned; drop its entry`);
  }
  return { files: files.length, problems };
}

if (require.main === module) {
  const { files, problems } = check();
  for (const line of problems) console.error(line);
  console.log(`course style: ${files} files, ${problems.length} problem(s)`);
  process.exitCode = problems.length ? 1 : 0;
}

module.exports = { breaks };
