// Runs every program in web/public/examples/ through the WASM emulator and
// asserts the post-halt state matches the comment in each file.
//
// Usage: node scripts/verify-examples.js

const fs = require("fs");
const path = require("path");

const wasmDir = process.env.WASM_DIR || "C:/Users/96654/AppData/Local/Temp/node-wasm-check";
const wasm = require(path.join(wasmDir, "aarch64_emulator.js"));

const examplesDir = path.join(__dirname, "..", "web", "public", "examples");

function hex(bigint) {
  return "0x" + BigInt(bigint).toString(16);
}

function run(file) {
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
  // peek memory at 0x10000000 for string-reverse
  const bytes = Array.from(emu.get_memory_range(0x10000000, 8));
  regs.mem_0x10000000 = bytes.map(b => b.toString(16).padStart(2, "0")).join(" ");
  regs.mem_0x10000000_ascii = bytes.map(b => b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".").join("");
  return { file, ok: true, steps: res.steps_executed, regs };
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
  const result = run(file);
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

console.log(`\n--- ${passed}/${passed + failed} examples match their comments ---`);
if (failed > 0) process.exit(1);
