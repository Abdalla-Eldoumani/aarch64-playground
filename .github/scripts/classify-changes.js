// Decides which check.yml jobs a pull request needs from the files it
// changes, read as `git diff --name-only -z` output on stdin. Pushes, the
// weekly run, and the pull request from integration pass --all instead.

// Each file gets the class of the first rule it matches. A file no rule
// matches counts as a workflow change, so a new kind of file runs every job
// until someone gives it a rule.
const RULES = [
  ["workflows", /^\.github\/(workflows|actions|scripts)\//],
  // No job checks the mobile app yet; its own class keeps a mobile/ change
  // from counting as unknown and running every job.
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

// Files outside emulator/ that the Rust tests read; the web tests' programs
// are shared with the call card's.
const READ_BY_RUST =
  /^(docs\/instruction-reference\.md$|web\/public\/examples\/cpsc355\/|web\/lib\/test\/emulator\/fixtures\/)/;

// Emulator test data the web tests read: error-explain's server transcripts
// and the dense -O2 program share.test measures a link with.
const READ_BY_WEB = /^emulator\/tests\/(error-parity\/|c-corpus\/78_switch_dense\.O2plain\.s$)/;

// What the production build is made from besides the emulator: the manifests,
// the build and deploy config, and the browser smoke test itself with the
// share encoder and the example it loads.
const BUILD_CONFIG =
  /^(web\/(package(-lock)?\.json|next\.config\.mjs|tsconfig\.json|tailwind\.config\.ts|postcss\.config\.js|lib\/playground\/share\.ts|public\/examples\/cpsc355\/locals\.s)$|vercel\.json$|package\.json$|scripts\/(write-precache-list\.js|browser-smoke\.mjs|smoke-noise\.mjs)$)/;

// The stack frames view the browser smoke reads, from the frames exports'
// decode to the stack tab's switch, its rows (FrameRow) included. Lessons'
// EmbedLayout is not on its page.
const FRAMES_VIEW =
  /^web\/(lib\/emulator\/(frame-data|stack-frames)\.ts|components\/(panels\/(FramesView|FrameRow)|playground\/(lazy-frames|StackTab))\.tsx)$/;

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
    // lint, typecheck, the dependency audit, and the toolchain pin check (all
    // a vercel-build.sh change needs); typecheck reads the wasm bundles' types
    static: everything || classes.has("web") || wasm,
    // verify-corpus, next build + size-limit, and the vitest shards
    web: everything || classes.has("web") || classes.has("content") || wasm || any(READ_BY_WEB),
    // the browser smoke test against a production build of the real wasm
    browser: everything || wasm || any(BUILD_CONFIG) || any(FRAMES_VIEW),
  };
}

const EVERYTHING = { classes: ["all"], rust: true, static: true, web: true, browser: true };

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
