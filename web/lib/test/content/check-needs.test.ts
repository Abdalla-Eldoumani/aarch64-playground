import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// .github/scripts/check-needs.js is the ci job's verdict and the one
// required status check, so it is run here exactly as the workflow runs
// it: node, with toJSON(needs) in NEEDS, judged by the exit code.
const SCRIPT = path.join(process.cwd(), "..", ".github", "scripts", "check-needs.js");

function run(needs: unknown) {
  const env = { ...process.env, NEEDS: JSON.stringify(needs) };
  const result = spawnSync(process.execPath, [SCRIPT], { env, encoding: "utf8" });
  return { code: result.status, stderr: result.stderr };
}

const job = (result: string) => ({ result, outputs: {} });

describe("the ci gate", () => {
  it("passes when every needed job succeeded", () => {
    expect(run({ changes: job("success"), rust: job("success") }).code).toBe(0);
  });

  it("passes when the path filter skipped jobs", () => {
    expect(run({ changes: job("success"), rust: job("skipped"), "web-test": job("skipped") }).code).toBe(0);
  });

  it("fails on a failed job and names it", () => {
    const { code, stderr } = run({ changes: job("success"), rust: job("failure") });
    expect(code).toBe(1);
    expect(stderr).toContain("rust: failure");
  });

  it("fails on a cancelled job", () => {
    expect(run({ changes: job("success"), "web-build": job("cancelled") }).code).toBe(1);
  });

  it("fails on a mix of passing, skipped, and failed jobs, naming only the failures", () => {
    const { code, stderr } = run({
      changes: job("success"),
      wasm: job("success"),
      rust: job("skipped"),
      "web-static": job("cancelled"),
      "web-test": job("failure"),
    });
    expect(code).toBe(1);
    expect(stderr).toContain("web-static: cancelled");
    expect(stderr).toContain("web-test: failure");
    expect(stderr).not.toContain("rust");
  });

  it("fails on a result it does not know and on a job with no result", () => {
    expect(run({ changes: job("neutral") }).code).toBe(1);
    expect(run({ changes: {} }).code).toBe(1);
  });

  it("fails when there is nothing to judge", () => {
    expect(run({}).code).toBe(1);
  });
});
