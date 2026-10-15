// The Rust toolchain and wasm-pack pins are written twice: in the workflows,
// which build and test with them, and in scripts/vercel-build.sh, which
// builds what deploys. Nothing else ties the two together, so a bump in one
// place alone tests one compiler in CI and ships another. This fails on any
// difference, and on a pin it can no longer find.
//
//   node .github/scripts/check-pins.js [repo root]

const fs = require("fs");
const path = require("path");

const SHELL_PIN = (name) => new RegExp(`^${name}="([^"]+)"`, "m");
const YAML_PIN = (name) => new RegExp(`^\\s*${name}:\\s*"([^"]+)"`, "m");

// The deploy script comes first: every other value is held to its.
const SOURCES = [
  {
    file: "scripts/vercel-build.sh",
    pins: { rust: SHELL_PIN("rust_toolchain"), "wasm-pack": SHELL_PIN("wasm_pack_version") },
  },
  {
    file: ".github/workflows/check.yml",
    pins: { rust: YAML_PIN("RUST_TOOLCHAIN"), "wasm-pack": YAML_PIN("WASM_PACK_VERSION") },
  },
  {
    file: ".github/workflows/browser.yml",
    pins: { rust: YAML_PIN("RUST_TOOLCHAIN"), "wasm-pack": YAML_PIN("WASM_PACK_VERSION") },
  },
  { file: ".github/workflows/bounds.yml", pins: { rust: YAML_PIN("RUST_TOOLCHAIN") } },
  { file: ".github/workflows/corpus.yml", pins: { rust: YAML_PIN("RUST_TOOLCHAIN") } },
];

/** Every way the pins disagree, given a reader from repo path to text. */
function mismatches(read) {
  const problems = [];
  const deployed = {};
  for (const { file, pins } of SOURCES) {
    const text = read(file);
    for (const [tool, pattern] of Object.entries(pins)) {
      const value = text.match(pattern)?.[1];
      if (value === undefined) {
        problems.push(`${file}: no ${tool} pin found`);
      } else if (!(tool in deployed)) {
        deployed[tool] = value;
      } else if (value !== deployed[tool]) {
        problems.push(`${file}: ${tool} ${value}, but scripts/vercel-build.sh deploys ${deployed[tool]}`);
      }
    }
  }
  return problems;
}

if (require.main === module) {
  const root = process.argv[2] ?? path.join(__dirname, "..", "..");
  const problems = mismatches((file) => fs.readFileSync(path.join(root, file), "utf8"));
  // exitCode rather than exit(): node exits once the output has flushed.
  if (problems.length) {
    console.error(`toolchain pins disagree:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log("toolchain pins match the deploy script");
  }
}

module.exports = { mismatches };
