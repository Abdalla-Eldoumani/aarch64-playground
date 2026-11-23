import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// scripts/audit-deps.js is CI's dependency gate, judged by its exit code.
// It runs here as CI runs it, with npm swapped for a stand-in that prints
// the given JSON and exits with the given status, as npm audit --json does.
const SCRIPT = path.join(process.cwd(), "..", "scripts", "audit-deps.js");

const STAND_IN = `
const out = process.env.NPM_STDOUT;
require("node:child_process").execFileSync = () => {
  if (process.env.NPM_STATUS === "0") return out;
  throw Object.assign(new Error("npm exited " + process.env.NPM_STATUS), { stdout: out });
};
require(process.env.AUDIT_SCRIPT);
`;

function audit(npmAnswer: unknown, npmStatus: number) {
  const env = {
    ...process.env,
    AUDIT_SCRIPT: SCRIPT,
    NPM_STDOUT: JSON.stringify(npmAnswer),
    NPM_STATUS: String(npmStatus),
  };
  const result = spawnSync(process.execPath, ["-e", STAND_IN], { env, encoding: "utf8", timeout: 10_000 });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const counts = (moderate: number) => ({
  info: 0,
  low: 0,
  moderate,
  high: 0,
  critical: 0,
  total: moderate,
});

describe("the dependency gate", () => {
  it("fails when npm audit answers with an error instead of a report", () => {
    // npm 10's answer when the registry cannot be reached.
    const { code, stdout } = audit(
      {
        message: "request to http://127.0.0.1:9/-/npm/v1/security/audits/quick failed",
        error: { summary: "", detail: "" },
      },
      1,
    );
    expect(code).toBe(2);
    expect(stdout).not.toContain("clean");
  });

  it("fails on an answer with no counts", () => {
    expect(audit({}, 0).code).toBe(2);
  });

  it("passes a clean report", () => {
    const { code, stdout } = audit({ vulnerabilities: {}, metadata: { vulnerabilities: counts(0) } }, 0);
    expect(code).toBe(0);
    expect(stdout).toContain("clean");
  });

  it("fails on a moderate advisory", () => {
    const report = {
      vulnerabilities: { left: { severity: "moderate", via: [{ title: "a moderate advisory" }] } },
      metadata: { vulnerabilities: counts(1) },
    };
    const { code, stderr } = audit(report, 1);
    expect(code).toBe(1);
    expect(stderr).toContain("left (moderate): a moderate advisory");
  });
});
