// Decides which check.yml jobs a pull request needs from the files it
// changes. .github/actions/changed-paths pipes `git diff --name-only -z` in
// on stdin; pushes and the weekly run pass --all instead and test
// everything. Prints one `name=true|false` line per job group and appends
// the same lines to $GITHUB_OUTPUT when the runner sets it.

// Each file gets the class of the first rule it matches. A file no rule
// matches counts as a workflow change, so a new kind of file runs every job
// until someone gives it a rule.
const RULES = [
  ["workflows", /^\.github\/(workflows|actions|scripts)\//],
  ["mobile", /^mobile\//],
  ["emulator", /^emulator\//],
  // Data the tests read: lessons, exercises, the shipped examples, and the
  // two docs that tests parse.
  [
    "content",
    /^(web\/content\/|web\/public\/examples\/|docs\/(instruction-reference|authoring-content)\.md$)/,
  ],
  ["web", /^(web\/|scripts\/|vercel\.json$|package\.json$|\.nvmrc$)/],
  ["docs", /^(docs\/|tools\/|\.github\/|[^/]*\.md$|LICENSE$|CITATION\.cff$|\.gitignore$)/],
];

// What the wasm bundles are built from; the wasm-bundles action's cache key
// hashes the same files.
const WASM_INPUTS = /^emulator\/(src\/|Cargo\.toml$|Cargo\.lock$)/;

// Files outside emulator/ that the Rust tests read.
const READ_BY_RUST = /^(docs\/instruction-reference\.md$|web\/public\/examples\/cpsc355\/)/;

function classOf(file) {
  const rule = RULES.find(([, pattern]) => pattern.test(file));
  return rule ? rule[0] : "workflows";
}

function classify(files) {
  const classes = new Set(files.map(classOf));
  const any = (pattern) => files.some((file) => pattern.test(file));
  const everything = classes.has("workflows");
  const wasm = any(WASM_INPUTS);
  return {
    classes: [...classes].sort(),
    // cargo test and the three corpus shards
    rust: everything || classes.has("emulator") || any(READ_BY_RUST),
    // lint, typecheck, and the dependency audit; typecheck reads the
    // wasm bundles' generated types
    static: everything || classes.has("web") || wasm,
    // verify-corpus, next build + size-limit, and the vitest shards
    web: everything || classes.has("web") || classes.has("content") || wasm,
    mobile: everything || classes.has("mobile"),
  };
}

const EVERYTHING = { classes: ["all"], rust: true, static: true, web: true, mobile: true };

if (require.main === module) {
  const fs = require("fs");
  const result = process.argv.includes("--all")
    ? EVERYTHING
    : classify(fs.readFileSync(0, "utf8").split(/[\0\n]/).filter(Boolean));
  const lines = Object.entries(result).map(([name, value]) => `${name}=${value}`);
  console.log(lines.join("\n"));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
}

module.exports = { classify };
