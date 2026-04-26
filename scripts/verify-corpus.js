// Runs every program in web/public/examples/ through the WASM emulator and
// asserts the post-halt state matches the comment in each file. Also runs
// any hosted cpsc 355 example with a matching `.stdin` / `.stdout` fixture
// pair under `web/public/examples/cpsc355/fixtures/` (populated in phase E).
//
// Usage: node scripts/verify-corpus.js

const fs = require("fs");
const path = require("path");

const wasmDir = process.env.WASM_DIR || path.join(__dirname, "..", "web", "lib", "wasm-node");
const wasm = require(path.join(wasmDir, "aarch64_emulator.js"));

const examplesDir = path.join(__dirname, "..", "web", "public", "examples");

function runBareMetal(file) {
  const src = fs.readFileSync(path.join(examplesDir, file), "utf8");
  const emu = new wasm.Emulator();
  const asm = emu.assemble_and_load(src);
  if (!asm.success) {
    return { file, ok: false, stage: "assemble", error: asm.error, line: asm.error_line };
  }
  const res = emu.run_until_break(100000);
  if (res.error) {
    return { file, ok: false, stage: "run", error: res.error };
  }
  if (!res.halted) {
    return { file, ok: false, stage: "run", error: `did not halt after ${res.steps_executed} steps` };
  }
  const regs = {};
  for (let i = 0; i < 31; i++) {
    regs[`X${i}`] = emu.get_register(i).toString();
  }
  const bytes = Array.from(emu.get_memory_range(0x10000000, 8));
  regs.mem_0x10000000 = bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
  regs.mem_0x10000000_ascii = bytes
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
    .join("");
  return { file, ok: true, steps: res.steps_executed, regs };
}

// Whitespace-quoted parser to keep the verifier's .args handling in sync
// with the in-app `parseArgs` (web/lib/args.ts). Supports double + single
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
// program may have created. Used for hosted corpus fixtures (phase E
// extends fixture coverage to all 13 cpsc 355 examples).
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

const expectations = {
  "factorial.s":     { X1: "120",  note: "5! = 120" },
  "fibonacci.s":     { X1: "55",   note: "fib(10) = 55" },
  "string-reverse.s":{ mem_0x10000000_ascii_startsWith: "OLLEH", note: "HELLO reversed" },
  "bubble-sort.s":   { X0: "1",    note: "first element of sorted [1,3,4,5,8]" },
  "gcd.s":           { X0: "6",    note: "gcd(48, 18) = 6" },
};

let passed = 0, failed = 0;
for (const file of Object.keys(expectations)) {
  const result = runBareMetal(file);
  const exp = expectations[file];
  console.log(`\n=== ${file} (${exp.note}) ===`);
  if (!result.ok) {
    console.log(`  FAIL at ${result.stage}: ${result.error}${result.line != null ? " at line " + result.line : ""}`);
    failed++;
    continue;
  }
  console.log(`  halted after ${result.steps} steps`);
  let ok = true;
  for (const key of Object.keys(exp)) {
    if (key === "note") continue;
    if (key.endsWith("_startsWith")) {
      const stem = key.slice(0, -"_startsWith".length);
      const actual = result.regs[stem] || "";
      if (!actual.startsWith(exp[key])) {
        console.log(`  FAIL: expected ${stem} to start with "${exp[key]}", got "${actual}"`);
        ok = false;
      } else {
        console.log(`  OK: ${stem} starts with "${exp[key]}"`);
      }
    } else {
      const actual = result.regs[key];
      if (actual !== exp[key]) {
        console.log(`  FAIL: expected ${key}=${exp[key]}, got ${actual}`);
        ok = false;
      } else {
        console.log(`  OK: ${key} = ${actual}`);
      }
    }
  }
  if (ok) passed++; else failed++;
}

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
      const expected = fs.readFileSync(stdoutPath, "utf8");
      if (result.stdout === expected) {
        console.log(`  OK: stdout matches fixture (${result.stdout.length} bytes)`);
      } else {
        console.log(`  FAIL: stdout mismatch`);
        console.log(`  expected: ${JSON.stringify(expected)}`);
        console.log(`  actual:   ${JSON.stringify(result.stdout)}`);
        ok = false;
      }
    }
    if (hasVfsOut) {
      const expectedVfs = JSON.parse(fs.readFileSync(vfsOutPath, "utf8"));
      for (const [name, body] of Object.entries(expectedVfs)) {
        if (result.vfs[name] === body) {
          console.log(`  OK: vfs ${name} matches (${body.length} bytes)`);
        } else {
          console.log(`  FAIL: vfs ${name} mismatch`);
          console.log(`  expected: ${JSON.stringify(body)}`);
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
    if (e.isDirectory() && e.name !== "fixtures") {
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
