// The persistence contract: silent degradation without IndexedDB, a
// roundtrip through it when present, shape-checking on the way out, and the
// over-cap skip. The stub below implements exactly the IDB surface the
// module touches (open -> transaction -> objectStore -> get/put), backed by
// a plain Map, so the tests pin behavior without a fake-IDB dependency.
import { afterEach, describe, expect, it } from "vitest";
import { MAX_VFS_BYTES } from "@/lib/playground/upload-guard";
import { loadPersistedVfs, savePersistedVfs, workingSetBytes } from "@/lib/playground/vfs-persist";

type Handler = (() => void) | null;

function installIdbStub(backing: Map<string, unknown>) {
  const makeRequest = <T,>(produce: () => T) => {
    const request: {
      result: T | undefined;
      onsuccess: Handler;
      onerror: Handler;
    } = { result: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      request.result = produce();
      request.onsuccess?.();
    });
    return request;
  };
  const store = {
    get: (key: string) => makeRequest(() => backing.get(key)),
    put: (value: unknown, key: string) => makeRequest(() => void backing.set(key, value)),
  };
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: () => {
      const tx: { oncomplete: Handler; onerror: Handler; onabort: Handler; objectStore: () => typeof store } = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => store,
      };
      // Complete after the put's microtask has landed.
      queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
      return tx;
    },
    close: () => {},
  };
  const open = () => {
    const request: { result: typeof db; onupgradeneeded: Handler; onsuccess: Handler; onerror: Handler; onblocked: Handler } = {
      result: db,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
    };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  };
  (globalThis as Record<string, unknown>).indexedDB = { open };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).indexedDB;
});

describe("vfs persistence", () => {
  it("degrades to session-only when IndexedDB is absent", async () => {
    expect(await loadPersistedVfs()).toBeNull();
    await expect(savePersistedVfs({ "a.txt": "1" })).resolves.toBeUndefined();
  });

  it("roundtrips the working set through the store", async () => {
    const backing = new Map<string, unknown>();
    installIdbStub(backing);
    await savePersistedVfs({ "numbers.txt": "1 2 3\n", "lab5.s": "mov x0, 0\n" });
    const loaded = await loadPersistedVfs();
    expect(loaded).toEqual({ "numbers.txt": "1 2 3\n", "lab5.s": "mov x0, 0\n" });
  });

  it("rejects a persisted payload that is not a name-to-text map", async () => {
    const backing = new Map<string, unknown>();
    backing.set("working-set", ["not", "a", "map"]);
    installIdbStub(backing);
    expect(await loadPersistedVfs()).toBeNull();
  });

  it("skips an over-cap save and keeps the previous copy", async () => {
    const backing = new Map<string, unknown>();
    installIdbStub(backing);
    await savePersistedVfs({ "keep.txt": "safe" });
    // One byte past the live VFS cap must not replace the stored set.
    const oversized = { "huge.bin": "x".repeat(MAX_VFS_BYTES + 1) };
    expect(workingSetBytes(oversized)).toBeGreaterThan(MAX_VFS_BYTES);
    await savePersistedVfs(oversized);
    expect(await loadPersistedVfs()).toEqual({ "keep.txt": "safe" });
  });

  it("measures the set in utf-8 bytes, names included", () => {
    expect(workingSetBytes({})).toBe(0);
    expect(workingSetBytes({ ab: "cd" })).toBe(4);
    // A two-byte character counts as two.
    expect(workingSetBytes({ a: "é" })).toBe(3);
  });
});
