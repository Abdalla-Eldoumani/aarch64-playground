// Differential server-parity sweep: every program the site ships is run
// twice, once through the WASM emulator (the node-target build, driven the
// way scripts/verify-corpus.js drives it) and once through the real course
// toolchain on csarm (`m4 | gcc`, then the binary), and the two sides are
// compared byte for byte on stdout, exit code, and the files the program
// wrote.
//
// The program set is derived from the tree on every run, never from a
// checked-in list: the shipped examples plus their fixtures, every lesson
// editor starter, every write / identify-bug exercise starter, the two
// starters in docs/authoring-content.md, every reference-entry payload the
// try-in-playground link carries, both halves of every pitfall, and the
// landing hero. A program that lands in any of those sources is swept the
// next time this runs, with no edit here.
//
// Scratch lives OUTSIDE the tree (default: aarch64-playground-parity under
// the OS temp directory, override with PARITY_SCRATCH): one directory per
// program holding program.s, stdin, args, its vfs files, and meta.json,
// plus results/ from each side and the report.
//
// Usage:
//   node scripts/parity-sweep.js                  enumerate, both sides, compare
//   node scripts/parity-sweep.js --playground-only enumerate + emulator side only
//   node scripts/parity-sweep.js --server-only     reuse a downloaded csarm
//                                                  results directory and compare
//   node scripts/parity-sweep.js --reuse-remote    rerun the csarm side over the
//                                                  tree already uploaded there
//   node scripts/parity-sweep.js --no-report       skip writing report.md
//
// --server-only consumes what a previous full run downloaded (or what was
// copied in by hand into <scratch>/server-results/); it still runs the
// emulator side, because that side is free and the comparison needs it.
//
// Requires web/lib/wasm-node (wasm-pack build --target nodejs --out-dir
// ../web/lib/wasm-node from emulator/) and, for the server side, key-based
// ssh to csarm.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const webRoot = path.join(repoRoot, "web");

const args = process.argv.slice(2);
const PLAYGROUND_ONLY = args.includes("--playground-only");
const SERVER_ONLY = args.includes("--server-only");
const WRITE_REPORT = !args.includes("--no-report");
// The upload is the slow half of the server side. --reuse-remote reruns the
// runner over the tree already on csarm, which is what a runner fix wants.
const REUSE_REMOTE = args.includes("--reuse-remote");

const SSH_HOST = process.env.PARITY_HOST || "abdalla.eldoumani@csarm.ucalgary.ca";
const REMOTE_ROOT = process.env.PARITY_REMOTE || "parity";
// A stuck program burns the sweep's whole budget, and half the exercise
// starters are deliberately unfinished, so both sides are capped.
const RUN_TIMEOUT_S = 10;
const M4_TIMEOUT_S = 30;
const GCC_TIMEOUT_S = 300;
const STEP_CAP = 20_000_000;
const SSH_DEADLINE_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------
// Scratch root. The sweep writes megabytes of per-program directories and
// two results trees; none of it belongs in the tree, so it goes to the OS
// temp directory unless PARITY_SCRATCH points somewhere else.
function resolveScratchRoot() {
  if (process.env.PARITY_SCRATCH) return path.resolve(process.env.PARITY_SCRATCH);
  return path.join(os.tmpdir(), "aarch64-playground-parity");
}
const scratchRoot = resolveScratchRoot();
const programsRoot = path.join(scratchRoot, "programs");
const serverResultsRoot = path.join(scratchRoot, "server-results");

// ---------------------------------------------------------------------
// The content modules are TypeScript with `@/` path aliases. Rather than
// re-parse them (a copied list drifts the first time a seed is added), the
// real modules are required through sucrase with the alias mapped, the same
// text the app imports.
function loadWebModules() {
  const Module = require("module");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    const resolved = request.startsWith("@/") ? path.join(webRoot, request.slice(2)) : request;
    return original.call(this, resolved, ...rest);
  };
  const sucrasePath = require.resolve("sucrase/register/ts", { paths: [webRoot] });
  require(sucrasePath);
  const load = (rel) => require(path.join(webRoot, rel));
  return {
    handoff: load("lib/playground/playground-handoff.ts"),
    source: load("lib/playground/playground-source.ts"),
    reference: load("lib/content/reference-data.ts"),
    pitfalls: load("lib/content/pitfall-data.ts"),
    landing: load("lib/content/landing-content.ts"),
  };
}

// Whitespace-quoted argv tokenizer, the same shape verify-corpus.js uses so
// both verifiers read a `.args` fixture the way web/lib/playground/args.ts
// reads the args box.
function parseArgsLine(input) {
  const out = [];
  let buf = "";
  let inQuote = null;
  let hasToken = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "\\" && i + 1 < input.length) { buf += input[i + 1]; hasToken = true; i++; continue; }
    if (inQuote) {
      if (ch === inQuote) { inQuote = null; continue; }
      buf += ch; hasToken = true; continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; hasToken = true; continue; }
    if (/\s/.test(ch)) {
      if (hasToken) { out.push(buf); buf = ""; hasToken = false; }
      continue;
    }
    buf += ch; hasToken = true;
  }
  if (hasToken) out.push(buf);
  return out;
}

// Mirrors combineSources in web/lib/playground/file-map.ts: main first so
// line numbers still point at the editor buffer, each helper behind its
// `// ---- name ----` boundary in the loader manifest's order.
function combineSources(main, extras) {
  if (extras.length === 0) return main;
  const parts = [main];
  for (const f of extras) {
    parts.push(`// ---- ${f.name} ----`);
    parts.push(f.body);
  }
  return parts.join("\n");
}

const toNum = (v) => (v == null ? null : Number(v));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------------
// Enumeration. Every entry is {id, source, kind, program, args, stdin,
// vfs, fixtureStem}. `kind` is console (run and compare), interactive (a
// terminal face: assembled and linked on both sides, never compared byte
// for byte) or leaf (no entry point by design; both sides must refuse it).

// is-prime ships as a leaf function with no entry point on purpose; its own
// header says to assemble it beside a caller and no such caller ships.
// Naming it keeps a main that goes missing from any other example a finding.
const LEAF_ONLY = { "is-prime": "leaf function, no entry point; no caller ships with it" };

// The three examples that wear a plain console face under the `console`
// argv token drive that face here with the scripted session from
// emulator/tests/filler_examples.rs, so their output is comparable rather
// than a full-screen ANSI frame. temp-convert is absent: it already carries
// a one-shot `.args` fixture, which is the deterministic face it ships.
const CONSOLE_FACE_DRIVES = {
  calc: "2+3*4\nsqrt(9)\ndeg\nsin(30)\n5/0\nq\n",
  "two-sum": "4\n2\n1000\n7\n11\n15\n9\n",
};

function enumerateExamples(mods) {
  const root = path.join(webRoot, "public", "examples", "cpsc355");
  const fixtures = path.join(root, "fixtures");
  const readFixture = (stem, ext) => {
    const p = path.join(fixtures, `${stem}.${ext}`);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };
  const out = [];
  for (const file of fs.readdirSync(root).sort()) {
    if (!file.endsWith(".s")) continue;
    const stem = file.slice(0, -2);
    const helpers = (mods.handoff.EXAMPLE_FILES[stem] || []).map((name) => ({
      name,
      body: fs.readFileSync(path.join(root, stem, name), "utf8"),
    }));
    const program = combineSources(fs.readFileSync(path.join(root, file), "utf8"), helpers);
    const entry = {
      id: `example-${stem}`,
      source: "examples",
      program,
      args: [],
      stdin: "",
      vfs: {},
      fixtureStem: stem,
      note: helpers.length > 0 ? `${helpers.length} helper files` : "",
    };
    if (LEAF_ONLY[stem]) {
      entry.kind = "leaf";
      entry.note = LEAF_ONLY[stem];
      out.push(entry);
      continue;
    }
    const argsRaw = readFixture(stem, "args");
    const stdinRaw = readFixture(stem, "stdin");
    const vfsRaw = readFixture(stem, "vfs.json");
    const expected = readFixture(stem, "stdout");
    if (argsRaw !== null) entry.args = parseArgsLine(argsRaw.trim());
    if (stdinRaw !== null) entry.stdin = stdinRaw;
    if (vfsRaw !== null) entry.vfs = JSON.parse(vfsRaw);
    if (expected !== null) entry.fixtureStdout = expected;
    if (argsRaw !== null || stdinRaw !== null || vfsRaw !== null || expected !== null) {
      entry.kind = "console";
    } else if (CONSOLE_FACE_DRIVES[stem]) {
      entry.kind = "console";
      entry.args = ["console"];
      entry.stdin = CONSOLE_FACE_DRIVES[stem];
      entry.note = "console face, scripted session";
      entry.noFixture = true;
    } else {
      entry.kind = "interactive";
      entry.note = entry.note || "terminal face only";
    }
    out.push(entry);
  }
  return out;
}

function enumerateLessons() {
  const dir = path.join(webRoot, "content", "lessons");
  const out = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    let n = 0;
    for (const block of doc.body || []) {
      if (block.type !== "editor" || typeof block.starter !== "string") continue;
      n++;
      out.push({
        id: `lesson-${doc.slug}${n > 1 ? `-${n}` : ""}`,
        source: "lessons",
        kind: "console",
        program: block.starter,
        args: block.args ? parseArgsLine(String(block.args)) : [],
        stdin: typeof block.stdin === "string" ? block.stdin : "",
        vfs: {},
        note: `${doc.slug} editor block ${n}`,
      });
    }
  }
  return out;
}

function enumerateExercises() {
  const dir = path.join(webRoot, "content", "exercises");
  const out = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    if (doc.variant !== "write" && doc.variant !== "identify-bug") continue;
    out.push({
      id: `exercise-${doc.slug}`,
      source: "exercises",
      kind: "console",
      program: doc.starter,
      args: doc.args ? parseArgsLine(String(doc.args)) : [],
      stdin: typeof doc.stdin === "string" ? doc.stdin : "",
      vfs: {},
      note: `${doc.variant} starter`,
    });
  }
  return out;
}

// The authoring guide's two fenced JSON blocks are copy-paste starters: a
// lesson (whose editor block holds the starter) and an exercise. A block
// that stops assembling is a broken instruction to a contributor.
function enumerateDocs() {
  const src = fs
    .readFileSync(path.join(repoRoot, "docs", "authoring-content.md"), "utf8")
    .replace(/\r\n/g, "\n");
  const out = [];
  const blocks = src.match(/```json\n([\s\S]*?)```/g) || [];
  for (const raw of blocks) {
    let doc;
    try {
      doc = JSON.parse(raw.replace(/^```json\n/, "").replace(/```$/, ""));
    } catch {
      continue;
    }
    if (Array.isArray(doc.body)) {
      let n = 0;
      for (const block of doc.body) {
        if (block.type !== "editor" || typeof block.starter !== "string") continue;
        n++;
        out.push({
          id: `docs-lesson-${slug(doc.slug || "starter")}${n > 1 ? `-${n}` : ""}`,
          source: "docs",
          kind: "console",
          program: block.starter,
          args: [], stdin: "", vfs: {},
          note: "authoring-content.md lesson example",
        });
      }
    }
    if (typeof doc.starter === "string") {
      out.push({
        id: `docs-exercise-${slug(doc.slug || "starter")}`,
        source: "docs",
        kind: "console",
        program: doc.starter,
        args: doc.args ? parseArgsLine(String(doc.args)) : [],
        stdin: typeof doc.stdin === "string" ? doc.stdin : "",
        vfs: {},
        note: "authoring-content.md exercise example",
      });
    }
  }
  return out;
}

function enumerateReference(mods) {
  return mods.reference.REFERENCE_INSTRUCTIONS.map((inst, i) => ({
    id: `ref-${String(i).padStart(3, "0")}-${slug(inst.mnemonic)}`,
    source: "reference",
    kind: "console",
    program: mods.source.playgroundSource(inst),
    args: [], stdin: "", vfs: {},
    note: inst.runnable ? `${inst.mnemonic} (authored runnable)` : `${inst.mnemonic} (wrapInMain)`,
  }));
}

function enumeratePitfalls(mods) {
  const out = [];
  mods.pitfalls.PITFALLS.forEach((p, i) => {
    for (const half of ["fault", "fix"]) {
      out.push({
        id: `pitfall-${i + 1}-${half}`,
        source: "pitfalls",
        kind: "console",
        program: p[half],
        args: [], stdin: "", vfs: {},
        // A fault half is authored to misbehave; parity means it misbehaves
        // the same way on both sides, not that it succeeds.
        note: `${p.title} (${half})`,
      });
    }
  });
  return out;
}

function enumerateHero(mods) {
  return [{
    id: "hero-program",
    source: "hero",
    kind: "console",
    program: mods.landing.HERO_PROGRAM,
    args: [], stdin: "", vfs: {},
    note: "landing HERO_PROGRAM",
  }];
}

function enumerate(mods) {
  const groups = [
    ["examples", enumerateExamples(mods)],
    ["lessons", enumerateLessons()],
    ["exercises", enumerateExercises()],
    ["docs", enumerateDocs()],
    ["reference", enumerateReference(mods)],
    ["pitfalls", enumeratePitfalls(mods)],
    ["hero", enumerateHero(mods)],
  ];
  console.log("=== program set ===");
  let total = 0;
  for (const [name, list] of groups) {
    console.log(`  ${name.padEnd(10)} ${String(list.length).padStart(4)}`);
    total += list.length;
  }
  console.log(`  ${"TOTAL".padEnd(10)} ${String(total).padStart(4)}`);
  const all = groups.flatMap(([, list]) => list);
  const seen = new Set();
  for (const p of all) {
    if (seen.has(p.id)) throw new Error(`duplicate program id ${p.id}`);
    seen.add(p.id);
  }
  return all;
}

// ---------------------------------------------------------------------
// Scratch materialization: one directory per program, exactly what gets
// uploaded, so a failing row can be reproduced by hand from the same bytes.
function materialize(programs) {
  fs.mkdirSync(programsRoot, { recursive: true });
  for (const existing of fs.readdirSync(programsRoot)) {
    fs.rmSync(path.join(programsRoot, existing), { recursive: true, force: true });
  }
  for (const p of programs) {
    const dir = path.join(programsRoot, p.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "program.s"), p.program);
    // One argv token per line: the runner reads it with a while loop, so no
    // shell quoting sits between the fixture and the process.
    if (p.args.length > 0) fs.writeFileSync(path.join(dir, "args"), p.args.join("\n") + "\n");
    if (p.stdin) fs.writeFileSync(path.join(dir, "stdin"), p.stdin);
    const vfsNames = Object.keys(p.vfs);
    if (vfsNames.length > 0) {
      fs.mkdirSync(path.join(dir, "vfs"), { recursive: true });
      for (const name of vfsNames) fs.writeFileSync(path.join(dir, "vfs", name), p.vfs[name]);
    }
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify({ id: p.id, source: p.source, kind: p.kind, args: p.args, note: p.note }, null, 2) + "\n",
    );
  }
  console.log(`\nwrote ${programs.length} program directories under ${programsRoot}`);
}

// ---------------------------------------------------------------------
// Playground side, driven the way verify-corpus.js drives it: assemble with
// argv (the loader owns argv[0] = ./program), upload the VFS AFTER assemble
// because loading resets the machine, push stdin, then run in slices so a
// program that blocks on stdin is reported rather than spun on.
function runPlayground(wasm, p) {
  const emu = new wasm.Emulator();
  const asm = emu.assemble_and_load_with_args(p.program, p.args);
  if (!asm.success) {
    return { built: false, error: asm.error, line: asm.error_line ?? null };
  }
  if (p.kind !== "console") return { built: true, ran: false };
  for (const [name, body] of Object.entries(p.vfs)) {
    emu.upload_vfs_file(name, Buffer.from(body, "utf8"));
  }
  if (p.stdin) emu.push_stdin(p.stdin);
  let remaining = STEP_CAP;
  let fault = null;
  let blocked = false;
  let capped = true;
  while (remaining > 0) {
    const res = emu.run_until_break(50_000);
    if (res.error) { fault = res.error; capped = false; break; }
    remaining -= res.steps_executed;
    if (res.halted || res.hit_breakpoint) { capped = false; break; }
    if (emu.is_blocked()) { blocked = true; capped = false; break; }
  }
  const vfs = {};
  for (const name of emu.list_vfs_files()) {
    vfs[name] = Buffer.from(emu.read_vfs_file(name)).toString("utf8");
  }
  return {
    built: true, ran: true, fault, blocked, capped,
    stdout: emu.take_stdout(),
    stderr: emu.take_stderr(),
    exit: toNum(emu.get_exit_code()),
    vfs,
  };
}

function runPlaygroundSide(programs) {
  const wasm = require(path.join(webRoot, "lib", "wasm-node", "aarch64_emulator.js"));
  const out = {};
  let built = 0, failed = 0;
  for (const p of programs) {
    const r = runPlayground(wasm, p);
    out[p.id] = r;
    if (r.built) built++; else failed++;
  }
  console.log(`\n=== playground side ===\n  ${built} built, ${failed} refused by the assembler`);
  fs.writeFileSync(path.join(scratchRoot, "playground-results.json"), JSON.stringify(out, null, 1));
  return out;
}

// ---------------------------------------------------------------------
// The csarm runner. Written from here rather than kept as a checked-in
// file so a rerun after the tree changes is one command and the script can
// never drift from the directory layout it walks.
const RUNNER = `#!/usr/bin/env bash
# Compile and run every uploaded program with the real course toolchain and
# record what came back. Run from ~/${REMOTE_ROOT}; writes into ~/${REMOTE_ROOT}/results/.
# One program per directory under programs/: program.s, optional stdin,
# optional args (one argv token per line), optional vfs/ files, meta.json.
cd "$(dirname "$0")" || exit 1
ROOT="$PWD"
RESULTS="$ROOT/results"
WORK="$ROOT/work"
mkdir -p "$RESULTS" "$WORK"
find "$RESULTS" -mindepth 1 -delete 2>/dev/null
find "$WORK" -mindepth 1 -delete 2>/dev/null
{
  echo "gcc:  $(gcc --version | head -1)"
  echo "as:   $(as --version | head -1)"
  echo "m4:   $(m4 --version | head -1)"
  echo "host: $(hostname)"
  echo "date: $(date -u)"
} > "$RESULTS/machine.txt"
count=0
for dir in "$ROOT"/programs/*/; do
  id="$(basename "$dir")"
  kind="$(sed -n 's/.*"kind": "\\([a-z]*\\)".*/\\1/p' "$dir/meta.json" | head -1)"
  out="$RESULTS/$id"
  run="$WORK/$id"
  mkdir -p "$out" "$run"
  # m4 is bounded: a source that defines the same alias twice makes GNU m4
  # rescan forever (the second define's first argument expands first, so
  # define(fp, x29) becomes define(x29, x29)), and an unbounded m4 stalls
  # the whole sweep on one program.
  timeout ${M4_TIMEOUT_S} m4 "$dir/program.s" > "$run/program.m4.s" 2> "$out/m4.err"
  echo "$?" > "$out/m4.exit"
  if [ "$(cat "$out/m4.exit")" != "0" ]; then
    echo "NOT_PREPROCESSED" > "$out/status"
    count=$((count + 1))
    continue
  fi
  if [ "$kind" = "interactive" ]; then
    ( cd "$run" && timeout ${GCC_TIMEOUT_S} gcc -Wall program.m4.s -o program ) > "$out/compile" 2>&1
  else
    ( cd "$run" && timeout ${GCC_TIMEOUT_S} gcc program.m4.s -o program ) > "$out/compile" 2>&1
  fi
  echo "$?" > "$out/compile.exit"
  echo "$kind" > "$out/kind"
  if [ ! -x "$run/program" ]; then
    echo "NOT_BUILT" > "$out/status"
    count=$((count + 1))
    continue
  fi
  if [ "$kind" != "console" ]; then
    echo "NOT_RUN" > "$out/status"
    count=$((count + 1))
    continue
  fi
  if [ -d "$dir/vfs" ]; then cp "$dir"/vfs/* "$run"/ 2>/dev/null; fi
  ARGV=()
  if [ -f "$dir/args" ]; then
    while IFS= read -r tok; do ARGV+=("$tok"); done < "$dir/args"
  fi
  if [ -f "$dir/stdin" ]; then IN="$dir/stdin"; else IN=/dev/null; fi
  # stdbuf keeps stdout line-buffered so a program that prints and then
  # faults leaves the same bytes behind that it does on a student's
  # terminal, which is what the emulator models.
  ( cd "$run" && timeout ${RUN_TIMEOUT_S} stdbuf -oL ./program "\${ARGV[@]}" < "$IN" > "$out/stdout" 2> "$out/stderr" )
  echo "$?" > "$out/exit"
  echo "RAN" > "$out/status"
  mkdir -p "$out/files"
  for f in "$run"/*; do
    base="$(basename "$f")"
    case "$base" in program|program.m4.s) continue ;; esac
    [ -f "$f" ] && cp "$f" "$out/files/$base"
  done
  count=$((count + 1))
done
echo "$count" > "$RESULTS/DONE"
`;

function ssh(command, opts = {}) {
  return spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", SSH_HOST, command], {
    encoding: "utf8", ...opts,
  });
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runServerSide(programs) {
  const runnerPath = path.join(scratchRoot, "run-on-csarm.sh");
  fs.writeFileSync(runnerPath, RUNNER.replace(/\r\n/g, "\n"));

  console.log("\n=== csarm side ===");
  let step;
  if (REUSE_REMOTE) {
    console.log("  reusing the program tree already on csarm, refreshing the runner");
    step = spawnSync("scp", ["-q", runnerPath, `${SSH_HOST}:~/${REMOTE_ROOT}/`], { encoding: "utf8" });
    if (step.status !== 0) throw new Error(`runner upload failed: ${step.stderr || step.error}`);
  } else {
    // A stale tree from a previous sweep would leave orphan results, so the
    // remote root is emptied before the upload rather than merged into. Best
    // effort: csarm's home is on NFS, and a file an interrupted run still
    // holds open lingers as a .nfsXXXX handle that nothing can unlink yet.
    // The upload overwrites everything that matters, so a leftover is a
    // warning rather than the end of the sweep.
    step = ssh(`mkdir -p ~/${REMOTE_ROOT} && find ~/${REMOTE_ROOT} -mindepth 1 -delete; exit 0`);
    if ((step.stderr || "").trim()) console.log("  note: remote wipe left something behind");
    console.log(`  uploading ${programs.length} program directories`);
    step = spawnSync("scp", ["-q", "-r", programsRoot, runnerPath, `${SSH_HOST}:~/${REMOTE_ROOT}/`], {
      encoding: "utf8", timeout: 20 * 60 * 1000,
    });
    if (step.status !== 0) throw new Error(`upload failed: ${step.stderr || step.error}`);
  }

  console.log("  running the sweep remotely");
  step = ssh(
    `cd ~/${REMOTE_ROOT} && chmod +x run-on-csarm.sh && nohup ./run-on-csarm.sh > sweep.log 2>&1 &  echo started`,
  );
  if (step.status !== 0) throw new Error(`could not start the runner: ${step.stderr}`);

  const deadline = Date.now() + SSH_DEADLINE_MS;
  let done = false;
  while (Date.now() < deadline) {
    sleepMs(15_000);
    const probe = ssh(`cat ~/${REMOTE_ROOT}/results/DONE 2>/dev/null || ls ~/${REMOTE_ROOT}/results | wc -l`);
    const line = (probe.stdout || "").trim().split(/\s+/).pop();
    console.log(`  ...${line} of ${programs.length}`);
    const finished = ssh(`test -f ~/${REMOTE_ROOT}/results/DONE && echo yes || echo no`);
    if ((finished.stdout || "").includes("yes")) { done = true; break; }
  }
  if (!done) throw new Error("the csarm runner did not finish before the deadline");

  console.log("  downloading results");
  fs.rmSync(serverResultsRoot, { recursive: true, force: true });
  fs.mkdirSync(scratchRoot, { recursive: true });
  step = spawnSync("scp", ["-q", "-r", `${SSH_HOST}:~/${REMOTE_ROOT}/results`, serverResultsRoot], {
    encoding: "utf8", timeout: 30 * 60 * 1000,
  });
  if (step.status !== 0) throw new Error(`download failed: ${step.stderr || step.error}`);
  console.log(`  results in ${serverResultsRoot}`);
}

function readServerResults(programs) {
  const out = {};
  for (const p of programs) {
    const dir = path.join(serverResultsRoot, p.id);
    if (!fs.existsSync(dir)) { out[p.id] = null; continue; }
    const read = (name) => {
      const f = path.join(dir, name);
      return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
    };
    const files = {};
    const filesDir = path.join(dir, "files");
    if (fs.existsSync(filesDir)) {
      for (const f of fs.readdirSync(filesDir)) {
        files[f] = fs.readFileSync(path.join(filesDir, f), "utf8");
      }
    }
    const compileExit = Number((read("compile.exit") || "1").trim());
    const m4Exit = Number((read("m4.exit") || "1").trim());
    // timeout(1) reports 124; the runner stops before gcc when m4 fails, so
    // the m4 verdict has to carry its own wording.
    const m4Note = m4Exit === 124
      ? "m4 never terminated (30 s cap): a repeated define expands into itself"
      : read("m4.err") || `m4 exited ${m4Exit}`;
    out[p.id] = {
      built: compileExit === 0 && m4Exit === 0,
      compile: read("compile") || "",
      m4err: m4Exit === 0 ? "" : m4Note,
      status: (read("status") || "").trim(),
      stdout: read("stdout"),
      stderr: read("stderr"),
      exit: read("exit") === null ? null : Number(read("exit").trim()),
      files,
    };
  }
  return out;
}

// ---------------------------------------------------------------------
// Comparison. The vocabulary is same | interactive | differs; the note
// column carries what actually happened, including the cases where parity
// means both sides refuse the program in the same way.
const firstDiff = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
};
const lf = (s) => (s == null ? "" : s.replace(/\r\n/g, "\n"));
const head = (s) => JSON.stringify(lf(s).slice(0, 200));

// timeout(1) reports 124; a signal-killed child reports 128+n.
function serverFault(r) {
  if (r.exit == null) return null;
  if (r.exit === 124) return "timed out";
  if (r.exit > 128) return `signal ${r.exit - 128}`;
  return null;
}

function compare(p, pg, sv) {
  if (!sv) return { verdict: "differs", note: "no csarm result for this program" };

  if (!pg.built || !sv.built) {
    if (!pg.built && !sv.built) {
      return {
        verdict: "same",
        note: `both refuse it -- playground: ${oneLine(pg.error)}; gcc: ${oneLine(sv.m4err || sv.compile)}`,
      };
    }
    if (!pg.built) {
      return {
        verdict: "differs",
        note: `the playground rejects what csarm accepts -- ${oneLine(pg.error)}`,
        detail: { playground: pg.error, server: "built cleanly" },
      };
    }
    return {
      verdict: "differs",
      note: `csarm rejects what the playground accepts -- ${oneLine(sv.m4err || sv.compile)}`,
      detail: { playground: "assembled cleanly", server: sv.m4err || sv.compile },
    };
  }

  if (p.kind !== "console") {
    const warnings = sv.compile.trim();
    return {
      verdict: "interactive",
      note: warnings ? `built with warnings: ${oneLine(warnings)}` : "both build clean; not run",
    };
  }

  const a = lf(pg.stdout);
  const b = lf(sv.stdout);
  const notes = [];
  let verdict = "same";
  if (a !== b) {
    verdict = "differs";
    const off = firstDiff(a, b);
    notes.push(`stdout differs at byte ${off}`);
  }
  const pgFault = pg.fault || (pg.blocked ? "blocked on stdin" : null) || (pg.capped ? "hit the step cap" : null);
  const svFault = serverFault(sv);
  if (pgFault && svFault) {
    notes.push(`both fault (playground: ${oneLine(pgFault)}; csarm: ${svFault})`);
  } else if (pgFault) {
    verdict = "differs";
    notes.push(`only the playground faults: ${oneLine(pgFault)}`);
  } else if (svFault) {
    verdict = "differs";
    notes.push(`only csarm faults: ${svFault}`);
  } else if (pg.exit !== null && sv.exit !== null && (pg.exit & 0xff) !== sv.exit) {
    verdict = "differs";
    notes.push(`exit ${pg.exit} vs ${sv.exit}`);
  }
  const names = new Set([...Object.keys(pg.vfs || {}), ...Object.keys(sv.files || {})]);
  for (const name of names) {
    if (lf((pg.vfs || {})[name]) !== lf((sv.files || {})[name])) {
      verdict = "differs";
      notes.push(`file ${name} differs`);
    }
  }
  return {
    verdict,
    note: notes.join("; ") || "stdout, exit code, and files all match",
    detail: verdict === "differs" ? { playground: a, server: b } : undefined,
  };
}

const oneLine = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, 160);

// The diagnosis behind each row that came back `differs` when the sweep was
// last read by hand. A row with no entry here prints as undiagnosed, which is
// the point: a NEW disagreement stands out instead of blending into the five
// that are understood.
const KNOWN_CAUSES = {
  "example-calc":
    "The playground hosts libm, so pow/sqrt/sin/cos/tan/log/log10/exp resolve here. gcc links libm only when told to, so the course command line for this program is `gcc calc.m4.s -o calc -lm`. The program itself is correct on both sides.",
  "example-dsav":
    "GNU m4 expands a define's FIRST argument. Each of dsav's files repeats `define(fp, x29)`, so once they are pasted into one buffer the second one arrives as `define(x29, x29)` and m4 loops forever on the next `x29`. The course build runs m4 once per file, so this is a property of the single-buffer paste rather than of dsav; the playground's own m4 binds names without expanding them and is unaffected.",
  "example-snake":
    "snake is freestanding: it defines `_start` and never defines `main`. gcc links crt1.o, which already defines `_start` and then calls `main`, so ld reports both a duplicate and a missing symbol. Build this one the way its own project does, with `as` and `ld` (or `gcc -nostartfiles`). GAS additionally warns that snake.s has no final newline.",
  "lesson-assembly-conditionals-basics":
    "A backtick inside a `//` comment (line 18). The playground strips comments before m4 runs, so it never sees it; GNU m4 does see it, treats it as an opening quote, and swallows the rest of the file (`ERROR: end of file in string`). The content fix is to use plain quotes in that comment.",
  "pitfall-6-fault":
    "By design, and the pitfall says so. The fault half reads x9 after a call, so it prints whatever the callee left behind: the playground's printf leaves announce's 1, glibc's leaves a stack address. Both halves demonstrate the same trap; the value is unspecified on either side.",
};

function report(programs, pgAll, svAll, machine) {
  const rows = [];
  for (const p of programs) {
    const r = compare(p, pgAll[p.id], svAll[p.id]);
    rows.push({ p, ...r });
  }
  console.log("\n=== parity ===");
  if (machine) console.log(machine.trim().split("\n").map((l) => "  " + l).join("\n"));
  const counts = { same: 0, interactive: 0, differs: 0 };
  for (const row of rows) {
    counts[row.verdict]++;
    console.log(`  ${row.verdict.padEnd(11)} ${row.p.id.padEnd(38)} ${row.note}`);
    if (row.verdict === "differs" && row.detail) {
      console.log(`      playground: ${head(row.detail.playground)}`);
      console.log(`      csarm:      ${head(row.detail.server)}`);
    }
  }
  console.log(`\n  same ${counts.same}  interactive ${counts.interactive}  differs ${counts.differs}`);

  if (WRITE_REPORT) {
    const bySource = {};
    for (const row of rows) {
      const s = (bySource[row.p.source] ||= { same: 0, interactive: 0, differs: 0 });
      s[row.verdict]++;
    }
    const lines = [];
    lines.push("# server-parity sweep");
    lines.push("");
    lines.push(`Generated by \`node scripts/parity-sweep.js\` on ${new Date().toISOString()}.`);
    lines.push("Not tracked: this file lives outside the repository on purpose.");
    lines.push("");
    lines.push("## toolchain");
    lines.push("");
    lines.push("```");
    lines.push((machine || "(no machine.txt)").trim());
    lines.push("```");
    lines.push("");
    lines.push("## summary");
    lines.push("");
    lines.push("| source | same | interactive | differs |");
    lines.push("| --- | --- | --- | --- |");
    for (const [s, c] of Object.entries(bySource)) {
      lines.push(`| ${s} | ${c.same} | ${c.interactive} | ${c.differs} |`);
    }
    lines.push(`| **total** | **${counts.same}** | **${counts.interactive}** | **${counts.differs}** |`);
    lines.push("");
    lines.push("`same` means stdout, exit code, and every written file matched byte for byte, or that both sides refused the program the same way. `interactive` is a terminal-face program: built on both sides, never compared. `differs` rows are listed in full at the bottom with the cause behind each.");
    lines.push("");
    lines.push("## every row");
    lines.push("");
    lines.push("| program | source | verdict | note |");
    lines.push("| --- | --- | --- | --- |");
    for (const row of rows) {
      lines.push(`| ${row.p.id} | ${row.p.source} | ${row.verdict} | ${row.note.replace(/\|/g, "\\|")} |`);
    }
    const diffs = rows.filter((r) => r.verdict === "differs");
    if (diffs.length > 0) {
      lines.push("");
      lines.push("## differs, in full");
      for (const row of diffs) {
        lines.push("");
        lines.push(`### ${row.p.id}`);
        lines.push("");
        lines.push(`- source: ${row.p.source} (${row.p.note})`);
        lines.push(`- ${row.note}`);
        lines.push(`- cause: ${KNOWN_CAUSES[row.p.id] || "NOT YET DIAGNOSED -- new since the last read"}`);
        if (row.detail) {
          lines.push("");
          lines.push("```");
          lines.push(`playground: ${head(row.detail.playground)}`);
          lines.push(`csarm:      ${head(row.detail.server)}`);
          lines.push("```");
        }
      }
    }
    const reportPath = path.join(scratchRoot, "report.md");
    fs.writeFileSync(reportPath, lines.join("\n") + "\n");
    console.log(`  report: ${reportPath}`);
  }
  return counts;
}

// ---------------------------------------------------------------------
function main() {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const mods = loadWebModules();
  const programs = enumerate(mods);
  materialize(programs);
  const pgAll = runPlaygroundSide(programs);
  if (PLAYGROUND_ONLY) {
    const refused = programs.filter((p) => !pgAll[p.id].built);
    for (const p of refused) console.log(`  REFUSED ${p.id}: ${oneLine(pgAll[p.id].error)}`);
    return;
  }
  if (!SERVER_ONLY) runServerSide(programs);
  if (!fs.existsSync(serverResultsRoot)) {
    throw new Error(`no csarm results at ${serverResultsRoot}; run without --server-only first`);
  }
  const machinePath = path.join(serverResultsRoot, "machine.txt");
  const machine = fs.existsSync(machinePath) ? fs.readFileSync(machinePath, "utf8") : null;
  report(programs, pgAll, readServerResults(programs), machine);
}

main();
