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

  it("fails closed on a file name that would write its own assembly line", () => {
    // The name is pasted into combineSources' `// ---- name ----` marker,
    // so a newline in it hands the linker lines nobody typed.
    const result = readWorkspaceBundle(
      JSON.stringify({
        version: 1,
        files: [
          { name: "main.asm", body: "ret\n" },
          { name: "helper.s\n.global evil\nevil:", body: "ret\n" },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: "file names may use letters, digits, dot, dash, and underscore only",
    });
  });

  it("fails closed on a traversing, empty, or overlong name", () => {
    const bundle = (name: string) =>
      readWorkspaceBundle(JSON.stringify({ version: 1, files: [{ name, body: "ret\n" }] }));
    expect(bundle("../secrets.s").ok).toBe(false);
    expect(bundle("sub/dir.s").ok).toBe(false);
    expect(bundle("   ").ok).toBe(false);
    expect(bundle("a".repeat(65)).ok).toBe(false);
    // A bundle carries the whole workspace, so main.asm itself stays legal.
    expect(bundle("main.asm").ok).toBe(true);
  });
});
