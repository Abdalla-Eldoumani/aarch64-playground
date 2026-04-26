import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";
import { MAX_C_SOURCE_BYTES } from "@/lib/upload-guard";

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/c-to-asm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const UPSTREAM_OK = {
  code: 0,
  asm: [{ text: "main:" }, { text: "\tmov w0, 1" }, { text: "\tret" }],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify(UPSTREAM_OK), { status: 200 }),
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/c-to-asm", () => {
  it("rejects an empty source", async () => {
    const res = await POST(makeRequest({ source: "", optLevel: "-O0" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/empty/);
  });

  it("rejects a malformed opt level", async () => {
    const res = await POST(
      makeRequest({ source: "int main(){return 0;}", optLevel: "-Onope" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON bodies", async () => {
    const res = await POST(makeRequest("not json"));
    expect(res.status).toBe(400);
  });

  it("returns asm from the upstream response", async () => {
    const res = await POST(
      makeRequest({ source: "int main(){return 1;}", optLevel: "-O0" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asm).toContain("mov w0, 1");
    expect(body.cached).toBe(false);
  });

  it("serves a cached response without calling upstream twice", async () => {
    const src = "int main(){return 2;}";
    const r1 = await POST(makeRequest({ source: src, optLevel: "-O0" }));
    await r1.json();
    const r2 = await POST(makeRequest({ source: src, optLevel: "-O0" }));
    const body2 = await r2.json();
    expect(body2.cached).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when upstream rejects with a 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("down", { status: 503 })),
    );
    const res = await POST(
      makeRequest({ source: "int main(){return 3;}", optLevel: "-O0" }),
    );
    expect(res.status).toBe(502);
  });

  it("rejects an oversized source body with 413", async () => {
    const huge = "// padding\n".repeat(Math.ceil(MAX_C_SOURCE_BYTES / 11) + 1);
    const res = await POST(makeRequest({ source: huge, optLevel: "-O0" }));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds/);
  });

  it("returns 504 when the upstream times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const err = new Error("aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }),
    );
    const res = await POST(
      makeRequest({ source: "int main(){return 4;}", optLevel: "-O0" }),
    );
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toMatch(/timed out/);
  });

  it("returns 400 when the compiler reports a diagnostic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 1,
            stderr: [{ text: "error: syntax" }],
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await POST(
      makeRequest({ source: "broken", optLevel: "-O0" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/syntax/);
  });
});
