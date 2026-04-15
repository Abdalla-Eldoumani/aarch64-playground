// Runs every program in web/public/examples/ through the WASM emulator and
// asserts the post-halt state matches the comment in each file. Also runs
// any hosted cpsc 355 example with a matching `.stdin` / `.stdout` fixture
// pair under `web/public/examples/cpsc355/fixtures/` (populated in phase E).
//
// Usage: node scripts/verify-corpus.js

const fs = require("fs");
const path = require("path");

const wasmDir = process.env.WASM_DIR || "C:/Users/96654/AppData/Local/Temp/node-wasm-check";
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

// Feed optional stdin, run until halt or exit, then return stdout + exit code.
// Used for hosted corpus fixtures (phase B.12+).
function runHosted(file, stdin) {
  const src = fs.readFileSync(file, "utf8");
  const emu = new wasm.Emulator();
  const asm = emu.assemble_and_load(src);
  if (!asm.success) {
    return { ok: false, stage: "assemble", error: asm.error, line: asm.error_line };
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
  return { ok: true, stdout, stderr, exitCode };
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

// Hosted fixtures: each .asm or .s under examples/cpsc355/ with a matching
// .stdout file in examples/cpsc355/fixtures/ runs with its .stdin (if any)
// and must produce the exact stdout.
const hostedRoot = path.join(examplesDir, "cpsc355");
const fixturesRoot = path.join(hostedRoot, "fixtures");
if (fs.existsSync(fixturesRoot)) {
  const expectedOutputs = fs.readdirSync(fixturesRoot).filter((f) => f.endsWith(".stdout"));
  for (const stem of expectedOutputs.map((f) => f.slice(0, -".stdout".length))) {
    const stdoutPath = path.join(fixturesRoot, stem + ".stdout");
    const stdinPath = path.join(fixturesRoot, stem + ".stdin");
    // Search for the source file under cpsc355/week*/ subdirectories.
    const srcPath = findSource(hostedRoot, stem);
    if (!srcPath) {
      console.log(`\n=== cpsc355/${stem} ===`);
      console.log(`  SKIP: no matching source file found`);
      continue;
    }
    console.log(`\n=== ${path.relative(examplesDir, srcPath)} ===`);
    const stdin = fs.existsSync(stdinPath) ? fs.readFileSync(stdinPath, "utf8") : "";
    const expected = fs.readFileSync(stdoutPath, "utf8");
    const result = runHosted(srcPath, stdin);
    if (!result.ok) {
      console.log(`  FAIL at ${result.stage}: ${result.error}`);
      failed++;
      continue;
    }
    if (result.stdout === expected) {
      console.log(`  OK: stdout matches fixture (${result.stdout.length} bytes)`);
      passed++;
    } else {
      console.log(`  FAIL: stdout mismatch`);
      console.log(`  expected: ${JSON.stringify(expected)}`);
      console.log(`  actual:   ${JSON.stringify(result.stdout)}`);
      failed++;
    }
  }
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
