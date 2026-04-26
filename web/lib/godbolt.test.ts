import { afterEach, describe, expect, test, vi } from "vitest";
import { compileCToAsm } from "./godbolt";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(status: number, body: unknown): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe("compileCToAsm", () => {
  test("returns asm + cached + sourceMap on success", async () => {
    mockFetchOnce(200, {
      asm: "mov w0, #0\nret\n",
      cached: true,
      sourceMap: [1, 1, null],
    });
    const out = await compileCToAsm("int main(){return 0;}", "-O2");
    expect(out.asm).toContain("mov");
    expect(out.cached).toBe(true);
    expect(out.sourceMap).toEqual([1, 1, null]);
  });

  test("forwards source + optLevel as JSON in the POST body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ asm: "ret\n", cached: false }),
    } as unknown as Response);
    global.fetch = fetchMock;
    await compileCToAsm("int x;", "-O0");
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/c-to-asm");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ source: "int x;", optLevel: "-O0" });
  });

  test("throws with the server-side error message on non-2xx", async () => {
    mockFetchOnce(502, { error: "godbolt unreachable" });
    await expect(compileCToAsm("x", "-O2")).rejects.toThrow("godbolt unreachable");
  });

  test("falls back to a status-based message when no error field is present", async () => {
    mockFetchOnce(503, {});
    await expect(compileCToAsm("x", "-O2")).rejects.toThrow(/status 503/);
  });
});
