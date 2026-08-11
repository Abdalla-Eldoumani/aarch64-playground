// Pins the star-count lookup's fail-closed contract: only a trustworthy count
// reaches the nav, every other outcome is null (the icon-only fallback), the
// request stays unauthenticated and hourly-revalidated, and nothing is logged.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStarCount, formatStarCount } from "@/lib/content/github";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function okWith(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

describe("fetchStarCount", () => {
  it("returns the count from an ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okWith({ stargazers_count: 214 })),
    );
    expect(await fetchStarCount()).toBe(214);
  });

  it("asks the public repo endpoint with the github media type and an hourly revalidation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okWith({ stargazers_count: 214 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchStarCount();

    // The whole init object is pinned, so an Authorization header cannot be
    // added by accident: this call is anonymous on purpose.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/Abdalla-Eldoumani/aarch64-playground",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 3600 },
      },
    );
  });

  it("returns null when the api answers 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Not Found" }),
      }),
    );
    expect(await fetchStarCount()).toBeNull();
  });

  it("returns null when the request throws, without logging", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    expect(await fetchStarCount()).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null when the body is not json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      }),
    );
    expect(await fetchStarCount()).toBeNull();
  });

  it("returns null when stargazers_count is missing or not a number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okWith({ name: "repo" })));
    expect(await fetchStarCount()).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okWith({ stargazers_count: "214" })),
    );
    expect(await fetchStarCount()).toBeNull();
  });

  it("returns null for a count of zero", async () => {
    // A rendered "0" reads as a broken widget, so zero takes the fallback.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okWith({ stargazers_count: 0 })),
    );
    expect(await fetchStarCount()).toBeNull();
  });
});

describe("formatStarCount", () => {
  it("prints counts under a thousand exactly", () => {
    expect(formatStarCount(0)).toBe("0");
    expect(formatStarCount(1)).toBe("1");
    expect(formatStarCount(42)).toBe("42");
    expect(formatStarCount(999)).toBe("999");
  });

  it("prints a thousand and up as one-decimal k with a bare .0 dropped", () => {
    expect(formatStarCount(1000)).toBe("1k");
    expect(formatStarCount(1204)).toBe("1.2k");
    expect(formatStarCount(12100)).toBe("12.1k");
  });
});
