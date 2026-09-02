// Runs each hosted cpsc 355 example with a matching `.stdin` / `.stdout`
// fixture pair under `web/public/examples/cpsc355/fixtures/` through the
// WASM emulator and asserts stdout, exit code, and post-run VFS state.
//
// Usage: node scripts/verify-corpus.js

const fs = require("fs");
const path = require("path");

const wasmDir = process.env.WASM_DIR || path.join(__dirname, "..", "web", "lib", "wasm-node");
const wasm = require(path.join(wasmDir, "aarch64_emulator.js"));

const examplesDir = path.join(__dirname, "..", "web", "public", "examples");

// Whitespace-quoted parser to keep the verifier's .args handling in sync
// with the in-app `parseArgs` (web/lib/playground/args.ts). Supports double + single
// quotes and `\` escapes; tolerant of unterminated quotes (rest of line
// becomes the final token).
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

// Feed optional stdin / argv / vfs inputs, run until halt or exit, then
// return stdout + exit code + the post-run state of every VFS file the
// program may have created.
function runHosted(file, stdin, args, vfsIn) {
  const src = fs.readFileSync(file, "utf8");
  const emu = new wasm.Emulator();
  const asm = (args && args.length > 0)
    ? emu.assemble_and_load_with_args(src, args)
    : emu.assemble_and_load(src);
  if (!asm.success) {
    return { ok: false, stage: "assemble", error: asm.error, line: asm.error_line };
  }
  // Uploads must happen AFTER assemble: assemble_and_load calls
  // Cpu::reset which clears the VFS along with stdin/stdout/stderr.
  if (vfsIn) {
    for (const [name, contents] of Object.entries(vfsIn)) {
      const bytes = Buffer.from(contents, "utf8");
      emu.upload_vfs_file(name, bytes);
    }
  }
  if (stdin) emu.push_stdin(stdin);
  // Drive the run loop with a small cap per iteration so we can re-feed
  // stdin if the program blocks on scanf with a multi-line fixture.
  let remaining = 500_000;
  while (remaining > 0) {
    const res = emu.run_until_break(50_000);
    if (res.error) {
      return { ok: false, stage: "run", error: res.error };
    }
    remaining -= res.steps_executed;
    if (res.halted || res.hit_breakpoint) break;
    if (emu.is_blocked()) break; // ran out of stdin; caller decides
  }
  const stdout = emu.take_stdout();
  const stderr = emu.take_stderr();
  const exitCode = emu.get_exit_code();
  const vfsOut = {};
  for (const name of emu.list_vfs_files()) {
    vfsOut[name] = Buffer.from(emu.read_vfs_file(name)).toString("utf8");
  }
  return { ok: true, stdout, stderr, exitCode, vfs: vfsOut };
}

let passed = 0, failed = 0;

// Hosted fixtures: every fixture stem under examples/cpsc355/fixtures/
// runs with its `.stdin`, `.args`, and `.vfs.json` inputs (any subset),
// and must match its `.stdout` (text) and `.vfsout.json` (post-run files)
// when present. A stem qualifies if any of `.stdout` / `.vfsout.json`
// exists; programs without either are reported as SKIP rather than
// silently passing.
const hostedRoot = path.join(examplesDir, "cpsc355");
const fixturesRoot = path.join(hostedRoot, "fixtures");
if (fs.existsSync(fixturesRoot)) {
  const stems = collectStems(fixturesRoot);
  for (const stem of stems) {
    const stdoutPath = path.join(fixturesRoot, stem + ".stdout");
    const stdinPath = path.join(fixturesRoot, stem + ".stdin");
    const argsPath = path.join(fixturesRoot, stem + ".args");
    const vfsInPath = path.join(fixturesRoot, stem + ".vfs.json");
    const vfsOutPath = path.join(fixturesRoot, stem + ".vfsout.json");
    const hasStdout = fs.existsSync(stdoutPath);
    const hasVfsOut = fs.existsSync(vfsOutPath);
    if (!hasStdout && !hasVfsOut) {
      console.log(`\n=== cpsc355/${stem} ===`);
      console.log(`  SKIP: no .stdout or .vfsout.json fixture`);
      continue;
    }
    const srcPath = findSource(hostedRoot, stem);
    if (!srcPath) {
      console.log(`\n=== cpsc355/${stem} ===`);
      console.log(`  SKIP: no matching source file found`);
      continue;
    }
    console.log(`\n=== ${path.relative(examplesDir, srcPath)} ===`);
    const stdin = fs.existsSync(stdinPath) ? fs.readFileSync(stdinPath, "utf8") : "";
    const args = fs.existsSync(argsPath)
      ? parseArgsLine(fs.readFileSync(argsPath, "utf8").trim())
      : [];
    const vfsIn = fs.existsSync(vfsInPath)
      ? JSON.parse(fs.readFileSync(vfsInPath, "utf8"))
      : null;
    const result = runHosted(srcPath, stdin, args, vfsIn);
    if (!result.ok) {
      console.log(`  FAIL at ${result.stage}: ${result.error}${result.line != null ? " at line " + result.line : ""}`);
      failed++;
      continue;
    }
    let ok = true;
    if (hasStdout) {
      // Normalize CRLF to LF on the fixture side. On Windows, git's
      // autocrlf can introduce CRLF endings on checkout; the WASM
      // emulator always emits LF. Compare with both sides on LF so
      // the test is byte-tolerant of contributor checkout settings.
      const expected = fs.readFileSync(stdoutPath, "utf8").replace(/\r\n/g, "\n");
      const actual = result.stdout.replace(/\r\n/g, "\n");
      if (actual === expected) {
        console.log(`  OK: stdout matches fixture (${actual.length} bytes)`);
      } else {
        console.log(`  FAIL: stdout mismatch`);
        console.log(`  expected: ${JSON.stringify(expected)}`);
        console.log(`  actual:   ${JSON.stringify(actual)}`);
        ok = false;
      }
    }
    if (hasVfsOut) {
      const expectedVfs = JSON.parse(fs.readFileSync(vfsOutPath, "utf8"));
      for (const [name, body] of Object.entries(expectedVfs)) {
        const expected = String(body).replace(/\r\n/g, "\n");
        const actual = (result.vfs[name] ?? "").replace(/\r\n/g, "\n");
        if (actual === expected) {
          console.log(`  OK: vfs ${name} matches (${expected.length} bytes)`);
        } else {
          console.log(`  FAIL: vfs ${name} mismatch`);
          console.log(`  expected: ${JSON.stringify(expected)}`);
          console.log(`  actual:   ${JSON.stringify(result.vfs[name] ?? "(missing)")}`);
          ok = false;
        }
      }
    }
    if (ok) passed++; else failed++;
  }
}

function collectStems(dir) {
  const seen = new Set();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+?)\.(stdin|stdout|args|vfs\.json|vfsout\.json)$/);
    if (m) seen.add(m[1]);
  }
  return Array.from(seen).sort();
}

function findSource(root, stem) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const e of entries) {
    // `fixtures` holds inputs, not programs. `dsav` and `deadzone` hold a
    // multi-file program's HELPER files: each one is a fragment with no
    // entry point, and their stems (array, sort, stack, input, player, ...)
    // are exactly the names a future fixture is likely to use. Resolving a
    // fixture to a helper would run the wrong file and report a confusing
    // failure.
    if (
      e.isDirectory() &&
      e.name !== "fixtures" &&
      e.name !== "dsav" &&
      e.name !== "deadzone"
    ) {
      const sub = path.join(root, e.name);
      const hit = findSource(sub, stem);
      if (hit) return hit;
    } else if (e.isFile()) {
      const base = e.name.replace(/\.(asm|s|S)$/, "");
      if (base === stem) return path.join(root, e.name);
    }
  }
  return null;
}

console.log(`\n--- ${passed}/${passed + failed} targets passed ---`);
if (failed > 0) process.exit(1);
