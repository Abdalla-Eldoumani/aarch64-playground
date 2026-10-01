// public/sw.js run in a fake worker scope: what it stores, what it refuses,
// what it serves offline, and when one build's cache replaces another's.
// The worker is a plain script, so it is evaluated as one, with the
// browser's cache and fetch replaced by small in-memory stand-ins.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const SOURCE = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://site.test";
const BUILD = "build-two";
const CACHE = `aarch64-playground-${BUILD}`;

const LIST = {
  build: BUILD,
  corePages: ["/playground", "/offline"],
  files: ["/_next/static/chunks/main.js", "/examples/cpsc355/basics.s", "/icon.png"],
  otherPages: ["/", "/learn", "/reference"],
  coreBytes: 1000,
  otherBytes: 2400,
};

/** A page from `build`, carrying the id where Next's payload carries it. */
function page(build = BUILD, status = 200): Response {
  return new Response(`<html><script>self.__next_f.push("b":"${build}")</script></html>`, {
    status,
    headers: { "content-type": "text/html" },
  });
}

/** The host's bot challenge: a 429 page that names no build. */
function challenge(): Response {
  return new Response("<html>checking your browser</html>", {
    status: 429,
    headers: { "x-vercel-mitigated": "challenge", "content-type": "text/html" },
  });
}

type Responder = (pathname: string) => Response | Promise<Response>;

class FakeCache {
  readonly entries = new Map<string, Response>();
  /** Addresses whose write fails the way a full disk fails it. */
  readonly full = new Set<string>();

  private key(req: string | { url: string }, ignoreSearch = false): string {
    const url = new URL(typeof req === "string" ? req : req.url, ORIGIN);
    if (ignoreSearch) url.search = "";
    return url.href;
  }

  async put(req: string | { url: string }, res: Response): Promise<void> {
    if (this.full.has(new URL(this.key(req)).pathname)) {
      throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    }
    this.entries.set(this.key(req), res.clone());
  }

  async match(req: string | { url: string }, options: { ignoreSearch?: boolean } = {}) {
    return this.entries.get(this.key(req, options.ignoreSearch))?.clone();
  }

  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }

  paths(): string[] {
    return [...this.entries.keys()].map((url) => new URL(url).pathname).sort();
  }
}

class FakeCaches {
  readonly stores = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async match(req: string) {
    for (const store of this.stores.values()) {
      const hit = await store.match(req);
      if (hit) return hit;
    }
    return undefined;
  }
}

interface Worker {
  caches: FakeCaches;
  messages: Record<string, unknown>[];
  claimed: () => boolean;
  setNetwork: (responder: Responder | null) => void;
  fire: (type: string, init?: Record<string, unknown>) => Promise<void>;
  request: (
    pathname: string,
    mode?: string,
    method?: string,
    headers?: Record<string, string>,
  ) => Promise<Response | null>;
}

/** Evaluates sw.js against fresh fakes. `null` network means offline. */
function startWorker(responder: Responder | null, caches = new FakeCaches()): Worker {
  const handlers: Record<string, (event: unknown) => void> = {};
  const messages: Record<string, unknown>[] = [];
  let claimed = false;
  let network = responder;
  const scope: Record<string, unknown> = {
    caches,
    Response,
    URL,
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    importScripts: (url: string) => {
      expect(url).toBe("/sw-precache.js");
      scope.PRECACHE = LIST;
    },
    fetch: async (input: string | { url: string }) => {
      if (!network) throw new TypeError("Failed to fetch");
      const url = new URL(typeof input === "string" ? input : input.url, ORIGIN);
      return network(url.pathname);
    },
    clients: {
      claim: async () => {
        claimed = true;
      },
      matchAll: async () => [{ postMessage: (data: Record<string, unknown>) => messages.push(data) }],
    },
  };
  scope.self = scope;
  vm.runInNewContext(SOURCE, scope);

  async function fire(type: string, init: Record<string, unknown> = {}): Promise<void> {
    const pending: Promise<unknown>[] = [];
    handlers[type]({ ...init, waitUntil: (p: Promise<unknown>) => pending.push(p) });
    // waitUntil may be called again while the first promises run.
    for (let i = 0; i < pending.length; i += 1) await pending[i];
  }

  async function request(pathname: string, mode = "no-cors", method = "GET", headers: Record<string, string> = {}) {
    let answer: Promise<Response> | null = null;
    const pending: Promise<unknown>[] = [];
    handlers.fetch({
      request: { url: new URL(pathname, ORIGIN).href, mode, method, headers: new Headers(headers) },
      respondWith: (p: Promise<Response>) => {
        answer = p;
      },
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    if (!answer) return null;
    const res = await answer;
    for (let i = 0; i < pending.length; i += 1) await pending[i];
    return res;
  }

  return {
    caches,
    messages,
    claimed: () => claimed,
    setNetwork: (next) => {
      network = next;
    },
    fire,
    request,
  };
}

/** A host serving this build, with a hook to change single addresses. */
function host(overrides: Record<string, () => Response> = {}): Responder {
  return (pathname) => {
    if (overrides[pathname]) return overrides[pathname]();
    if ([...LIST.corePages, ...LIST.otherPages].includes(pathname)) return page();
    if (LIST.files.includes(pathname)) return new Response(`file ${pathname}`);
    return new Response("not found", { status: 404 });
  };
}

async function installed(responder: Responder = host()): Promise<Worker> {
  const worker = startWorker(responder);
  await worker.fire("install");
  await worker.fire("activate");
  return worker;
}

describe("installing a build", () => {
  it("saves the playground, the offline page and every listed file, under the build's name", async () => {
    const worker = startWorker(host());
    await worker.fire("install");
    expect([...worker.caches.stores.keys()]).toEqual([CACHE]);
    expect(worker.caches.stores.get(CACHE)!.paths()).toEqual(
      [...LIST.corePages, ...LIST.files].sort(),
    );
  });

  it("stores nothing when one file answers with the host's challenge", async () => {
    const worker = startWorker(host({ "/examples/cpsc355/basics.s": challenge }));
    await expect(worker.fire("install")).rejects.toThrow(/429/);
    expect(await worker.caches.keys()).toEqual([]);
  });

  it("stores nothing when the host already serves a newer deploy's page", async () => {
    const worker = startWorker(host({ "/playground": () => page("build-three") }));
    await expect(worker.fire("install")).rejects.toThrow();
    expect(await worker.caches.keys()).toEqual([]);
  });

  it("refuses a redirected answer", async () => {
    const redirected = () => {
      const res = page();
      Object.defineProperty(res, "redirected", { value: true });
      return res;
    };
    const worker = startWorker(host({ "/offline": redirected }));
    await expect(worker.fire("install")).rejects.toThrow();
    expect(await worker.caches.keys()).toEqual([]);
  });

  it("reuses an older build's copy of a content-named file instead of downloading it again", async () => {
    const caches = new FakeCaches();
    const old = await caches.open("aarch64-playground-build-one");
    await old.put("/_next/static/chunks/main.js", new Response("kept copy"));
    // An example keeps its address when edited, so it is always fetched.
    await old.put("/examples/cpsc355/basics.s", new Response("old text"));
    const fetched: string[] = [];
    const worker = startWorker((pathname) => {
      fetched.push(pathname);
      return host()(pathname);
    }, caches);
    await worker.fire("install");
    expect(fetched).not.toContain("/_next/static/chunks/main.js");
    expect(fetched).toContain("/examples/cpsc355/basics.s");
    const cache = caches.stores.get(CACHE)!;
    expect(await (await cache.match("/_next/static/chunks/main.js"))?.text()).toBe("kept copy");
    expect(await (await cache.match("/examples/cpsc355/basics.s"))?.text()).toBe(
      "file /examples/cpsc355/basics.s",
    );
  });

  it("keeps every page saved across an update when the last build had them all", async () => {
    const caches = new FakeCaches();
    const old = await caches.open("aarch64-playground-build-one");
    await old.put("/sw-saved-every-page", new Response("2026-09-30T12:00:00.000Z"));
    const worker = startWorker(host(), caches);
    await worker.fire("install");
    const paths = caches.stores.get(CACHE)!.paths();
    for (const url of LIST.otherPages) expect(paths).toContain(url);
    expect(paths).toContain("/sw-saved-every-page");
  });
});

describe("activating a build", () => {
  it("deletes every other cache and takes over open pages", async () => {
    const caches = new FakeCaches();
    await caches.open("aarch64-playground-build-one");
    await caches.open("cpsc355-runtime-v7");
    const worker = startWorker(host(), caches);
    await worker.fire("install");
    await worker.fire("activate");
    expect(await caches.keys()).toEqual([CACHE]);
    expect(worker.claimed()).toBe(true);
  });
});

describe("opening a page", () => {
  it("shows the network's answer and keeps a page from this build", async () => {
    const worker = await installed();
    const res = await worker.request("/learn", "navigate");
    expect(res?.status).toBe(200);
    expect(worker.caches.stores.get(CACHE)!.paths()).toContain("/learn");
  });

  it("shows the host's challenge so the reader can pass it, and never stores it", async () => {
    const worker = await installed();
    worker.setNetwork(host({ "/learn": challenge, "/playground": challenge }));
    expect((await worker.request("/learn", "navigate"))?.status).toBe(429);
    expect((await worker.request("/playground", "navigate"))?.status).toBe(429);
    const cache = worker.caches.stores.get(CACHE)!;
    expect(cache.paths()).not.toContain("/learn");
    expect(await (await cache.match("/playground"))?.text()).toContain(BUILD);
  });

  it("does not keep a newer deploy's page in this build's cache", async () => {
    const worker = await installed();
    worker.setNetwork(host({ "/learn": () => page("build-three") }));
    expect((await worker.request("/learn", "navigate"))?.status).toBe(200);
    expect(worker.caches.stores.get(CACHE)!.paths()).not.toContain("/learn");
  });

  it("offline, answers with the saved page, whatever the query", async () => {
    const worker = await installed();
    worker.setNetwork(null);
    const res = await worker.request("/playground?run=terminal", "navigate");
    expect(await res?.text()).toContain(BUILD);
  });

  it("offline, answers an unsaved page with the offline page, never the landing", async () => {
    const worker = await installed();
    const cache = worker.caches.stores.get(CACHE)!;
    await cache.put("/offline", new Response("offline page"));
    worker.setNetwork(null);
    expect(await (await worker.request("/learn", "navigate"))?.text()).toBe("offline page");
    expect(await (await worker.request("/no-such-page", "navigate"))?.text()).toBe("offline page");
  });
});

describe("loading a file", () => {
  it("serves a listed file from the cache, ignoring the icon's hash query", async () => {
    const worker = await installed();
    worker.setNetwork(null);
    expect(await (await worker.request("/_next/static/chunks/main.js"))?.text()).toBe(
      "file /_next/static/chunks/main.js",
    );
    expect(await (await worker.request("/icon.png?4d2a"))?.text()).toBe("file /icon.png");
  });

  it("offline, answers the router's page data with an empty 204 so Next falls back quietly", async () => {
    const worker = await installed();
    const online = await worker.request("/learn?_rsc=abc", "cors", "GET", { RSC: "1" });
    expect(online?.status).toBe(200);
    worker.setNetwork(null);
    const offline = await worker.request("/learn?_rsc=abc", "cors", "GET", { RSC: "1" });
    expect(offline?.status).toBe(204);
    expect(offline?.body).toBeNull();
    expect(worker.caches.stores.get(CACHE)!.paths()).not.toContain("/learn");
  });

  it("leaves unlisted, cross-origin and non-GET requests to the browser", async () => {
    const worker = await installed();
    expect(await worker.request("/learn?_rsc=abc")).toBeNull();
    expect(await worker.request("/_next/static/chunks/another-build.js")).toBeNull();
    expect(await worker.request("https://elsewhere.test/_next/static/chunks/main.js")).toBeNull();
    expect(await worker.request("/_next/static/chunks/main.js", "no-cors", "POST")).toBeNull();
  });
});

describe("saving every page", () => {
  it("saves the rest of the pages, reports progress, then the date", async () => {
    const worker = await installed();
    await worker.fire("message", { data: { type: "save-every-page" } });
    const cache = worker.caches.stores.get(CACHE)!;
    for (const url of LIST.otherPages) expect(cache.paths()).toContain(url);
    const progress = worker.messages.filter((m) => m.saving).map((m) => m.saving);
    expect(progress[0]).toEqual({ done: 0, total: 3 });
    expect(progress.at(-1)).toEqual({ done: 3, total: 3 });
    const last = worker.messages.at(-1)!;
    expect(last).toMatchObject({ type: "offline-status", pages: 3, bytes: 2400, saving: null, failure: null });
    expect(Number.isNaN(Date.parse(String(last.savedAt)))).toBe(false);
  });

  it("stops without the date when the connection drops, keeping what it saved", async () => {
    const worker = await installed();
    worker.setNetwork(host({ "/reference": challenge }));
    await worker.fire("message", { data: { type: "save-every-page" } });
    expect(worker.messages.at(-1)).toMatchObject({ savedAt: null, failure: "network", saving: null });
    expect(worker.caches.stores.get(CACHE)!.paths()).toContain("/learn");
  });

  it("says the device is full when a write runs out of space", async () => {
    const worker = await installed();
    worker.caches.stores.get(CACHE)!.full.add("/learn");
    await worker.fire("message", { data: { type: "save-every-page" } });
    expect(worker.messages.at(-1)).toMatchObject({ savedAt: null, failure: "storage" });
  });

  it("says the site was updated when the host serves a newer deploy", async () => {
    const worker = await installed();
    worker.setNetwork(host({ "/": () => page("build-three") }));
    await worker.fire("message", { data: { type: "save-every-page" } });
    expect(worker.messages.at(-1)).toMatchObject({ savedAt: null, failure: "update" });
  });

  it("answers a status question without saving anything", async () => {
    const worker = await installed();
    await worker.fire("message", { data: { type: "offline-status" } });
    expect(worker.messages).toEqual([
      { type: "offline-status", pages: 3, bytes: 2400, savedAt: null, saving: null, failure: null },
    ]);
    expect(worker.caches.stores.get(CACHE)!.paths()).not.toContain("/learn");
  });
});
