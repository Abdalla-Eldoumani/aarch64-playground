// pins the multi-file workspace state behind the tab strip: a write that
// replaces the strip keeps whatever it discarded recoverable, restore appends
// beside the new program's own helpers, an edit or a rename is not a
// discard, a program load keeps every helper text it does not bring back,
// and the backup survives a reload. When storage is full the backup gives
// way before the student's files, oldest entries first, and never keeps less
// than the last load's files.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useSourceFiles } from "@/lib/hooks/use-source-files";
import type { SourceFile } from "@/lib/playground/file-map";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("useSourceFiles", () => {
  // Loading a program REPLACES the strip on purpose. Without the backup, a
  // plain click on a recent program (no confirm) takes every helper file with
  // it and rewrites the strip's localStorage key to `[]`.
  it("keeps a wiped strip recoverable and appends it back on restore", () => {
    const { result } = renderHook(() => useSourceFiles());
    act(() => {
      result.current[1]([
        { name: "util.s", body: "// util" },
        { name: "sort.s", body: "// sort" },
      ]);
    });
    expect(result.current[2].count).toBe(0);

    // A program handoff with no files of its own.
    act(() => {
      result.current[1]([]);
    });
    expect(result.current[0]).toEqual([]);
    expect(result.current[2].count).toBe(2);

    act(() => {
      result.current[2].restore();
    });
    expect(result.current[0].map((f) => f.name)).toEqual(["util.s", "sort.s"]);
    expect(result.current[2].count).toBe(0);
  });

  it("restores beside a program's own helpers rather than over them", () => {
    const { result } = renderHook(() => useSourceFiles());
    act(() => {
      result.current[1]([{ name: "mine.s", body: "// mine" }]);
    });
    act(() => {
      result.current[1]([{ name: "theirs.s", body: "// theirs" }]);
    });
    expect(result.current[2].count).toBe(1);
    act(() => {
      result.current[2].restore();
    });
    expect(result.current[0].map((f) => f.name)).toEqual(["theirs.s", "mine.s"]);
  });

  it("does not offer a restore for an edit or a rename", () => {
    const { result } = renderHook(() => useSourceFiles());
    act(() => {
      result.current[1]([{ name: "util.s", body: "// util" }]);
    });
    act(() => {
      result.current[1]([{ name: "util.s", body: "// util edited" }]);
    });
    expect(result.current[2].count).toBe(0);
    act(() => {
      result.current[1]([{ name: "helpers.s", body: "// util edited" }]);
    });
    expect(result.current[2].count).toBe(0);
  });

  it("brings the backup back after a reload", () => {
    const first = renderHook(() => useSourceFiles());
    act(() => {
      first.result.current[1]([{ name: "util.s", body: "// util" }]);
    });
    act(() => {
      first.result.current[1]([]);
    });
    first.unmount();

    const second = renderHook(() => useSourceFiles());
    expect(second.result.current[2].count).toBe(1);
  });

  describe("a program load", () => {
    const seed = (files: { name: string; body: string }[]) =>
      window.localStorage.setItem("aarch64-playground:multi-files", JSON.stringify(files));

    // An example or a link may bring a helper under a name the student
    // already uses; the student's text must not go with the old tab.
    it("keeps a helper it replaces under the same name, and restores it beside the program's", () => {
      seed([{ name: "stack.s", body: "// student work" }]);
      const { result } = renderHook(() => useSourceFiles());
      act(() => {
        result.current[1]([{ name: "stack.s", body: "// example" }], { load: true });
      });
      expect(result.current[2].count).toBe(1);
      act(() => {
        result.current[2].restore();
      });
      expect(result.current[0]).toEqual([
        { name: "stack.s", body: "// example" },
        { name: "2-stack.s", body: "// student work" },
      ]);
    });

    // Two loads in a row (one link delivered twice, or two links) must not
    // let the second push the student's files out of the backup.
    it("keeps the student's helpers through a second load", () => {
      seed([{ name: "mine.s", body: "// mine" }]);
      const { result } = renderHook(() => useSourceFiles());
      act(() => {
        result.current[1]([{ name: "zz.s", body: "// zz" }], { load: true });
      });
      act(() => {
        result.current[1]([], { load: true });
      });
      act(() => {
        result.current[2].restore();
      });
      expect(result.current[0]).toEqual([
        { name: "mine.s", body: "// mine" },
        { name: "zz.s", body: "// zz" },
      ]);
    });

    it("keeps the backup when the next load replaces nothing", () => {
      seed([{ name: "mine.s", body: "// mine" }]);
      const { result } = renderHook(() => useSourceFiles());
      act(() => {
        result.current[1]([], { load: true });
      });
      act(() => {
        result.current[1]([], { load: true });
      });
      expect(result.current[2].count).toBe(1);
      act(() => {
        result.current[2].restore();
      });
      expect(result.current[0]).toEqual([{ name: "mine.s", body: "// mine" }]);
    });

    // The free name stays inside the strip's 64-character cap, or a share
    // link holding it would be refused.
    it("keeps a restored helper's free name within the name length cap", () => {
      const long = `${"a".repeat(62)}.s`;
      seed([{ name: long, body: "// student work" }]);
      const { result } = renderHook(() => useSourceFiles());
      act(() => {
        result.current[1]([{ name: long, body: "// example" }], { load: true });
      });
      act(() => {
        result.current[2].restore();
      });
      expect(result.current[0][1]).toEqual({ name: `2-${"a".repeat(62)}`, body: "// student work" });
    });

    it("does not restore a second copy of a helper the strip already holds unchanged", () => {
      seed([{ name: "util.s", body: "// util" }]);
      const { result } = renderHook(() => useSourceFiles());
      act(() => {
        result.current[1]([], { load: true });
      });
      act(() => {
        result.current[1]([{ name: "util.s", body: "// util" }], { load: true });
      });
      act(() => {
        result.current[2].restore();
      });
      expect(result.current[0]).toEqual([{ name: "util.s", body: "// util" }]);
    });
  });
});

describe("useSourceFiles when storage is full", () => {
  const STORE = "aarch64-playground:multi-files";
  const BACKUP = "aarch64-playground:multi-files-backup";
  const realSetItem = Storage.prototype.setItem;

  // localStorage that holds `limit` characters of keys and values in all,
  // and refuses a write past that the way a browser does.
  const capStorage = (limit: number) =>
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      let used = key.length + value.length;
      for (let i = 0; i < this.length; i++) {
        const other = this.key(i) ?? "";
        if (other !== key) used += other.length + (this.getItem(other) ?? "").length;
      }
      if (used > limit) throw new DOMException("storage is full", "QuotaExceededError");
      realSetItem.call(this, key, value);
    });

  const stored = (key: string): SourceFile[] =>
    JSON.parse(window.localStorage.getItem(key) ?? "[]") as SourceFile[];
  const file = (name: string, tag: string, size: number): SourceFile => ({
    name,
    body: `// ${tag}\n${"x".repeat(size)}`,
  });
  // A body is its tag line and filler, so a failure names files by tag.
  const tags = (files: SourceFile[]) => files.map((f) => f.body.split("\n")[0]);

  function mount() {
    const { result } = renderHook(() => useSourceFiles());
    return {
      files: () => result.current[0],
      count: () => result.current[2].count,
      save: (next: SourceFile[], how?: { load: boolean }) => act(() => result.current[1](next, how)),
      restore: () => act(() => result.current[2].restore()),
    };
  }

  // What the page shows against what a reload finds.
  function expectStored(h: ReturnType<typeof mount>, lastLoadReplaced: SourceFile[]) {
    expect(tags(stored(STORE)), "the student's current files are stored").toEqual(tags(h.files()));
    expect(tags(stored(BACKUP)), "the backup holds the last load's files").toEqual(
      expect.arrayContaining(tags(lastLoadReplaced)),
    );
    expect(h.count(), "the restore count is what is stored").toBe(stored(BACKUP).length);
    const reloaded = mount();
    expect(tags(reloaded.files())).toEqual(tags(h.files()));
    expect(reloaded.count()).toBe(h.count());
  }

  // Another site's data leaves `room` characters: ten course-sized loads,
  // then the student adds a helper of their own.
  it.each([10_000, 20_000, 40_000])(
    "keeps the student's files and the last load's with %i characters left",
    (room) => {
      capStorage(4 * room);
      window.localStorage.setItem("other-site-data", "o".repeat(3 * room));
      const student = [1, 2, 3].map((j) => file(`s${j}.s`, `student ${j}`, room / 20));
      window.localStorage.setItem(STORE, JSON.stringify(student));
      const h = mount();
      let replaced: SourceFile[] = [];
      for (let i = 1; i <= 10; i++) {
        replaced = h.files();
        h.save(
          ["stack.s", "queue.s", "utils.s"].map((n) => file(n, `program ${i} ${n}`, room / 20)),
          { load: true },
        );
        expectStored(h, replaced);
      }
      h.save([...h.files(), file("t.s", "student T", room / 10)]);
      expectStored(h, replaced);
    },
  );

  // Five links of four large helpers each, with a helper the student writes
  // before the fifth; then the student restores.
  it.each([20_000, 40_000, 80_000])(
    "keeps the student's files and the last load's through five links in %i characters",
    (quota) => {
      capStorage(quota);
      const student = [1, 2, 3].map((j) => file(`s${j}.s`, `student ${j}`, quota / 200));
      window.localStorage.setItem(STORE, JSON.stringify(student));
      const link = (k: number) =>
        [1, 2, 3, 4].map((j) => file(`l${k}-${j}.s`, `link ${k} file ${j}`, quota / 20));
      const h = mount();
      let replaced: SourceFile[] = [];
      for (let k = 1; k <= 4; k++) {
        replaced = h.files();
        h.save(link(k), { load: true });
        expectStored(h, replaced);
      }
      h.save([...h.files(), file("t.s", "student T", quota / 100)]);
      expectStored(h, replaced);
      replaced = h.files();
      h.save(link(5), { load: true });
      expectStored(h, replaced);

      const kept = tags([...h.files(), ...stored(BACKUP)]);
      h.restore();
      expect(tags(h.files())).toEqual(kept);
      expect(tags(stored(STORE)), "the restored files are stored").toEqual(kept);
      expect(stored(BACKUP)).toEqual([]);
      expect(h.count()).toBe(0);
    },
  );

  it("leaves the stored backup in place when a restore cannot write the strip", () => {
    window.localStorage.setItem(STORE, JSON.stringify([{ name: "mine.s", body: "// mine" }]));
    const h = mount();
    h.save([{ name: "zz.s", body: "// zz" }], { load: true });
    const backup = window.localStorage.getItem(BACKUP);
    // Every write of the strip fails from here on.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === STORE) throw new DOMException("storage is full", "QuotaExceededError");
      realSetItem.call(this, key, value);
    });
    h.restore();
    expect(window.localStorage.getItem(BACKUP), "the stored backup is intact").toBe(backup);
    expect(stored(STORE)).toEqual([{ name: "zz.s", body: "// zz" }]);
    expect(h.count(), "the restore count is what is stored").toBe(1);
    expect(mount().count()).toBe(1);
  });

  // Blocked site data refuses every write: the tab still restores, and the
  // count clears as it always did, since no reload could offer the files.
  it("clears the restore count when storage refuses every write", () => {
    window.localStorage.setItem(STORE, JSON.stringify([{ name: "mine.s", body: "// mine" }]));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("site data is blocked", "SecurityError");
    });
    const h = mount();
    h.save([{ name: "zz.s", body: "// zz" }], { load: true });
    expect(h.count()).toBe(1);
    h.restore();
    expect(h.files()).toEqual([
      { name: "zz.s", body: "// zz" },
      { name: "mine.s", body: "// mine" },
    ]);
    expect(h.count()).toBe(0);
  });
});
