// Pins the field-by-field read of an untrusted `.json` workspace bundle.
import { describe, expect, it } from "vitest";
import { readWorkspaceBundle } from "@/lib/playground/workspace-bundle";

describe("readWorkspaceBundle", () => {
  it("trims names and keeps the declared order", () => {
    const result = readWorkspaceBundle(
      JSON.stringify({ version: 1, files: [{ name: " main.asm ", body: "ret\n" }] }),
    );
    expect(result).toEqual({ ok: true, files: [{ name: "main.asm", body: "ret\n" }] });
  });

  it("fails closed on a version it does not know", () => {
    const result = readWorkspaceBundle(JSON.stringify({ version: 2, files: [] }));
    expect(result).toEqual({
      ok: false,
      error: "that .json file is not a workspace bundle",
    });
  });

  it("fails closed on text that is not json", () => {
    expect(readWorkspaceBundle("mov x0, 1").ok).toBe(false);
  });
});
