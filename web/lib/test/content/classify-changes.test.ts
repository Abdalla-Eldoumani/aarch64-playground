import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// .github/scripts/classify-changes.js picks the check.yml jobs a pull
// request runs from the files it changes. It is CommonJS one level above
// web/ (vitest's cwd), so it is loaded by path.
const SCRIPT = path.join(process.cwd(), "..", ".github", "scripts", "classify-changes.js");
const { classify } = createRequire(import.meta.url)(SCRIPT) as {
  classify: (files: string[]) => Record<string, unknown>;
};

const NOTHING = { rust: false, static: false, web: false };
const EVERYTHING = { rust: true, static: true, web: true };

describe("the path filter", () => {
  it("runs the web jobs and not the Rust ones for a web change", () => {
    expect(classify(["web/components/ui/Button.tsx", "scripts/bundle-budget.js"])).toEqual({
      classes: ["web"],
      ...NOTHING,
      static: true,
      web: true,
    });
  });

  it("runs nothing heavy for a docs change", () => {
    expect(
      classify(["README.md", "docs/DEPLOY.md", "tools/miscellaneous/printing.asm", ".github/CODEOWNERS"]),
    ).toEqual({ classes: ["docs"], ...NOTHING });
  });

  it("runs everything for an emulator source change, since the wasm bundles change", () => {
    expect(classify(["emulator/src/executor.rs"])).toEqual({ classes: ["emulator"], ...EVERYTHING });
  });

  it("runs only the Rust jobs for an emulator test change", () => {
    expect(classify(["emulator/tests/simd.rs"])).toEqual({ classes: ["emulator"], ...NOTHING, rust: true });
  });

  it("runs the tests and the build but not lint for a content change", () => {
    expect(classify(["web/content/lessons/02-loops.json", "docs/authoring-content.md"])).toEqual({
      classes: ["content"],
      ...NOTHING,
      web: true,
    });
  });

  it("adds the Rust jobs when content the Rust tests read changes", () => {
    expect(classify(["docs/instruction-reference.md"]).rust).toBe(true);
    expect(classify(["web/public/examples/cpsc355/hello.s"]).rust).toBe(true);
    expect(classify(["web/lib/test/emulator/fixtures/call-printf.s"]).rust).toBe(true);
    expect(classify(["web/content/exercises/sum.json"]).rust).toBe(false);
  });

  it("adds the Rust jobs when a web file the wasm_codes test reads changes", () => {
    expect(classify(["web/lib/emulator/call-cards.ts"]).rust).toBe(true);
    expect(classify(["web/lib/emulator/stack-frames.ts"]).rust).toBe(true);
    expect(classify(["web/lib/emulator/clobber-note.ts"]).rust).toBe(true);
    expect(classify(["web/lib/emulator/frame-cards.ts"]).rust).toBe(false);
  });

  it("runs the pin check and not the cargo jobs for a deploy script change", () => {
    // web-static's check-pins step holds the script's toolchain pins to the workflows.
    expect(classify(["scripts/vercel-build.sh"])).toEqual({
      classes: ["web"],
      ...NOTHING,
      static: true,
      web: true,
    });
  });

  it("runs the web tests for emulator test data the web tests read", () => {
    expect(classify(["emulator/tests/error-parity/ldr_unknown.server.txt"])).toEqual({
      classes: ["emulator"],
      ...NOTHING,
      rust: true,
      web: true,
    });
    expect(classify(["emulator/tests/c-corpus/78_switch_dense.O2plain.s"]).web).toBe(true);
    expect(classify(["emulator/tests/c-corpus/01_hello.c"]).web).toBe(false);
    // check-workflow.test holds check.yml's cargo skip to a test in c_corpus.rs.
    expect(classify(["emulator/tests/c_corpus.rs"])).toEqual({
      classes: ["emulator"],
      ...NOTHING,
      rust: true,
      web: true,
    });
    expect(classify(["emulator/tests/frames.rs"]).web).toBe(false);
  });

  it("runs the Rust jobs as well as the web ones for the example catalog", () => {
    // frames.rs and filler_examples.rs read its helper lists.
    expect(classify(["web/lib/playground/example-catalog.ts"])).toEqual({
      classes: ["web"],
      ...NOTHING,
      rust: true,
      static: true,
      web: true,
    });
    expect(classify(["web/lib/playground/playground-handoff.ts"]).rust).toBe(false);
  });

  it("runs the Rust jobs as well as the web ones for the editor's completions", () => {
    // stub_table.rs reads its list of library calls.
    expect(classify(["web/lib/asm/asm-completion.ts"])).toEqual({
      classes: ["web"],
      ...NOTHING,
      rust: true,
      static: true,
      web: true,
    });
  });

  it("runs the build and its browser smoke for every file the smoke depends on", () => {
    // The files that started the separate browser job: the wasm's sources,
    // the manifests, the build and deploy config, the smoke and what it
    // loads, and the stack frames view.
    for (const file of [
      "emulator/src/frames.rs",
      "emulator/src/frames/layout.rs",
      "emulator/Cargo.toml",
      "emulator/Cargo.lock",
      "package.json",
      "vercel.json",
      "web/package.json",
      "web/package-lock.json",
      "web/next.config.mjs",
      "web/tsconfig.json",
      "web/tailwind.config.ts",
      "web/postcss.config.js",
      "web/lib/playground/share.ts",
      "web/public/examples/cpsc355/locals.s",
      "scripts/write-precache-list.js",
      "scripts/browser-smoke.mjs",
      "scripts/smoke-noise.mjs",
      "web/lib/emulator/frame-data.ts",
      "web/lib/emulator/stack-frames.ts",
      "web/components/panels/FramesView.tsx",
      "web/components/panels/FrameRow.tsx",
      "web/components/playground/lazy-frames.tsx",
      "web/components/playground/StackTab.tsx",
    ]) {
      expect(classify([file]).web, file).toBe(true);
    }
    // What that job missed: the smoke's other imports and the components
    // that own the names it clicks.
    for (const file of [
      "web/lib/playground/walkthrough.ts",
      "web/lib/playground/upload-guard.ts",
      "web/components/playground/Controls.tsx",
      "web/components/panels/ConsolePanel.tsx",
    ]) {
      expect(classify([file]).web, file).toBe(true);
    }
    for (const file of ["emulator/tests/simd.rs", "emulator/tests/frames.rs", "docs/DEPLOY.md"]) {
      expect(classify([file]).web, file).toBe(false);
    }
  });

  it("runs everything for a workflow change", () => {
    expect(classify([".github/workflows/check.yml"])).toEqual({ classes: ["workflows"], ...EVERYTHING });
    expect(classify([".github/scripts/check-needs.js"])).toEqual({ classes: ["workflows"], ...EVERYTHING });
  });

  it("runs nothing for a mobile change", () => {
    expect(classify(["mobile/app/index.tsx"])).toEqual({ classes: ["mobile"], ...NOTHING });
  });

  it("runs everything for a file no rule knows", () => {
    expect(classify([".gitattributes"])).toEqual({ classes: ["workflows"], ...EVERYTHING });
    expect(classify(['"web/caf\\303\\251.ts"'])).toEqual({ classes: ["workflows"], ...EVERYTHING });
  });

  it("runs the union for a mixed change and nothing for an empty one", () => {
    expect(classify(["docs/README.md", "mobile/app.json", "web/app/page.tsx"])).toEqual({
      classes: ["docs", "mobile", "web"],
      ...NOTHING,
      static: true,
      web: true,
    });
    expect(classify([])).toEqual({ classes: [], ...NOTHING });
  });
});

describe("the path filter as the workflow runs it", () => {
  function run(args: string[], stdin: string) {
    const dir = mkdtempSync(path.join(tmpdir(), "classify-"));
    const env = { ...process.env, GITHUB_OUTPUT: path.join(dir, "out") };
    try {
      const result = spawnSync(process.execPath, [SCRIPT, ...args], { env, input: stdin, encoding: "utf8" });
      expect(result.status).toBe(0);
      return readFileSync(env.GITHUB_OUTPUT, "utf8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("reads NUL-separated paths from stdin and writes the step outputs", () => {
    expect(run([], "docs/DEPLOY.md\0emulator/tests/simd.rs\0")).toBe(
      "classes=docs,emulator\nrust=true\nstatic=false\nweb=false\n",
    );
  });

  it("turns every job on with --all", () => {
    expect(run(["--all"], "")).toBe("classes=all\nrust=true\nstatic=true\nweb=true\n");
  });
});
