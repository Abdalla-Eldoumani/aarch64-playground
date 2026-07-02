import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  EXAMPLE_INPUTS,
  MAX_VFS_FIXTURE_FILES,
  fetchExample,
  parseVfsFixture,
  resolveBoot,
  resolveHandoff,
} from "@/lib/playground-handoff";
import { buildShareHash } from "@/lib/share";
import { encodeBundle } from "@/lib/diagnostic-bundle";
import {
  MAX_ARGS_CHARS,
  MAX_SOURCE_BYTES,
  MAX_STDIN_BYTES,
} from "@/lib/upload-guard";

const SHARE_HASH = buildShareHash({
  source: "mov x0, 7",
  args: "a b",
  stdin: "in\n",
  cursor: { line: 2, column: 3 },
});

const BUNDLE_QUERY = `?bundle=${encodeBundle({
  source: "mov x1, 9",
  args: "x",
  stdin: "y\n",
})}`;

describe("resolveBoot", () => {
  it("prefers a bundle deep-link over everything", () => {
    const boot = resolveBoot(BUNDLE_QUERY, SHARE_HASH, "saved", "default");
    expect(boot.source).toBe("mov x1, 9");
    expect(boot.args).toBe("x");
    expect(boot.stdin).toBe("y\n");
    expect(boot.fromBundle).toBe(true);
    expect(boot.fromShare).toBe(false);
  });

  it("prefers a share hash over the autosave", () => {
    const boot = resolveBoot("", SHARE_HASH, "saved", "default");
    expect(boot.source).toBe("mov x0, 7");
    expect(boot.args).toBe("a b");
    expect(boot.stdin).toBe("in\n");
    expect(boot.cursor).toEqual({ line: 2, column: 3 });
    expect(boot.fromShare).toBe(true);
    expect(boot.fromBundle).toBe(false);
  });

  it("falls back to the autosave, then the default", () => {
    expect(resolveBoot("", "", "saved work", "default").source).toBe("saved work");
    expect(resolveBoot("", "", null, "default").source).toBe("default");
    expect(resolveBoot("", "", "", "default").source).toBe("default");
  });

  it("treats a malformed share hash as absent", () => {
    const boot = resolveBoot("", "#p2=%%%not-lz%%%", "saved", "default");
    expect(boot.source).toBe("saved");
    expect(boot.fromShare).toBe(false);
  });
});

describe("resolveHandoff", () => {
  it("returns nothing when the boot already consumed the payload (hard load)", () => {
    expect(
      resolveHandoff({ fromShare: true, fromBundle: false }, "", SHARE_HASH),
    ).toBeNull();
    expect(
      resolveHandoff({ fromShare: false, fromBundle: true }, BUNDLE_QUERY, ""),
    ).toBeNull();
  });

  it("delivers a share payload the render-time boot missed (client-side navigation)", () => {
    const decision = resolveHandoff(
      { fromShare: false, fromBundle: false },
      "",
      SHARE_HASH,
    );
    expect(decision).not.toBeNull();
    if (decision?.kind !== "share") throw new Error("expected share");
    expect(decision.payload.source).toBe("mov x0, 7");
    expect(decision.payload.args).toBe("a b");
    expect(decision.payload.stdin).toBe("in\n");
    expect(decision.payload.cursor).toEqual({ line: 2, column: 3 });
    expect(decision.payload.fromShare).toBe(true);
  });

  it("delivers a bundle the boot missed, ahead of a share hash", () => {
    const decision = resolveHandoff(
      { fromShare: false, fromBundle: false },
      BUNDLE_QUERY,
      SHARE_HASH,
    );
    if (decision?.kind !== "bundle") throw new Error("expected bundle");
    expect(decision.payload.source).toBe("mov x1, 9");
  });

  it("suppresses the example fetch when a share payload is in the URL", () => {
    const consumed = resolveHandoff(
      { fromShare: true, fromBundle: false },
      "?example=basics",
      SHARE_HASH,
    );
    expect(consumed).toBeNull();
  });

  it("resolves an example stem, translating legacy names", () => {
    const decision = resolveHandoff(
      { fromShare: false, fromBundle: false },
      "?example=week03_exercise",
      "",
    );
    expect(decision).toEqual({ kind: "example", stem: "basics" });
  });

  it("returns nothing for a bare playground URL", () => {
    expect(resolveHandoff({ fromShare: false, fromBundle: false }, "", "")).toBeNull();
  });
});

describe("parseVfsFixture", () => {
  it("accepts a flat name-to-content object", () => {
    expect(parseVfsFixture('{"input.txt": "hello\\n"}')).toEqual({
      "input.txt": "hello\n",
    });
  });

  it.each([
    ["not JSON", "{nope"],
    ["an array", '["a"]'],
    ["a null", "null"],
    ["non-string contents", '{"a": 1}'],
    ["nested objects", '{"a": {"b": "c"}}'],
    ["an empty name", '{"": "x"}'],
    ["an oversize name", `{"${"n".repeat(200)}": "x"}`],
  ])("rejects %s", (_label, raw) => {
    expect(() => parseVfsFixture(raw)).toThrow();
  });

  it("rejects too many files", () => {
    const big: Record<string, string> = {};
    let i = 0;
    while (i <= MAX_VFS_FIXTURE_FILES) {
      big[`f${i}.txt`] = "x";
      i++;
    }
    expect(() => parseVfsFixture(JSON.stringify(big))).toThrow(/too many/);
  });
});

describe("fetchExample", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(routes: Record<string, string | number>) {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        const hit = routes[url];
        if (hit === undefined || typeof hit === "number") {
          return { ok: false, status: (hit as number) ?? 404, statusText: "Not Found", text: async () => "" };
        }
        return { ok: true, status: 200, statusText: "OK", text: async () => hit };
      }),
    );
    return calls;
  }

  it("fetches only the source for an example with no declared inputs", async () => {
    const calls = stubFetch({ "/examples/cpsc355/basics.s": "mov x0, 1\n" });
    const payload = await fetchExample("basics");
    expect(payload).toEqual({ source: "mov x0, 1\n", label: "basics" });
    expect(calls).toEqual(["/examples/cpsc355/basics.s"]);
  });

  it("delivers args, trimmed, for an args example", async () => {
    stubFetch({
      "/examples/cpsc355/command-line-args.s": "src",
      "/examples/cpsc355/fixtures/command-line-args.args": "./myecho hello world\n",
    });
    const payload = await fetchExample("command-line-args");
    expect(payload.args).toBe("./myecho hello world");
  });

  it("delivers stdin for a stdin example", async () => {
    stubFetch({
      "/examples/cpsc355/echo.s": "src",
      "/examples/cpsc355/fixtures/echo.stdin": "hello\n",
    });
    const payload = await fetchExample("echo");
    expect(payload.stdin).toBe("hello\n");
  });

  it("delivers the vfs file set for a file-reading example", async () => {
    stubFetch({
      "/examples/cpsc355/read-file.s": "src",
      "/examples/cpsc355/fixtures/read-file.vfs.json": '{"input.txt": "Hi\\n"}',
    });
    const payload = await fetchExample("read-file");
    expect(payload.vfs).toEqual({ "input.txt": "Hi\n" });
  });

  it("throws on a missing example or missing declared fixture", async () => {
    stubFetch({});
    await expect(fetchExample("basics")).rejects.toThrow(/404/);
    stubFetch({ "/examples/cpsc355/echo.s": "src" });
    await expect(fetchExample("echo")).rejects.toThrow(/echo\.stdin/);
  });

  it("rejects payloads beyond the upload caps", async () => {
    stubFetch({ "/examples/cpsc355/basics.s": "x".repeat(MAX_SOURCE_BYTES + 1) });
    await expect(fetchExample("basics")).rejects.toThrow(/too large/);

    stubFetch({
      "/examples/cpsc355/echo.s": "src",
      "/examples/cpsc355/fixtures/echo.stdin": "x".repeat(MAX_STDIN_BYTES + 1),
    });
    await expect(fetchExample("echo")).rejects.toThrow(/too large/);

    stubFetch({
      "/examples/cpsc355/command-line-args.s": "src",
      "/examples/cpsc355/fixtures/command-line-args.args": "a".repeat(MAX_ARGS_CHARS + 1),
    });
    await expect(fetchExample("command-line-args")).rejects.toThrow(/too long/);
  });

  it("rejects a malformed vfs fixture", async () => {
    stubFetch({
      "/examples/cpsc355/read-file.s": "src",
      "/examples/cpsc355/fixtures/read-file.vfs.json": '["not", "a", "map"]',
    });
    await expect(fetchExample("read-file")).rejects.toThrow(/object/);
  });

  it("rejects a stem that fails the path-safety pattern without fetching", async () => {
    const calls = stubFetch({});
    await expect(fetchExample("../secrets")).rejects.toThrow(/invalid/);
    expect(calls).toEqual([]);
  });
});

describe("EXAMPLE_INPUTS manifest", () => {
  it("matches the input fixtures on disk exactly", () => {
    const dir = path.join(process.cwd(), "public/examples/cpsc355/fixtures");
    const onDisk: Record<string, { args?: true; stdin?: true; vfs?: true }> = {};
    for (const file of fs.readdirSync(dir)) {
      const m = file.match(/^(.+?)\.(args|stdin|vfs\.json)$/);
      if (!m) continue;
      const stem = m[1];
      const kind = m[2] === "vfs.json" ? "vfs" : (m[2] as "args" | "stdin");
      onDisk[stem] = { ...onDisk[stem], [kind]: true };
    }
    expect(EXAMPLE_INPUTS).toEqual(onDisk);
  });
});
