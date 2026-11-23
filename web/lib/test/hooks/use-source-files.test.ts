// pins the multi-file workspace state behind the tab strip: a write that
// replaces the strip keeps whatever it discarded recoverable, restore appends
// beside the new program's own helpers, an edit or a rename is not a
// discard, a program load keeps every helper text it does not bring back,
// and the backup survives a reload. The backup key holds what it always
// did; a load's other copies sit apart, so that when storage is full they
// give way and the store holds what it would without them.
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
  const COPIES = "aarch64-playground:multi-files-copies";
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

  const usedChars = () => {
    let used = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) ?? "";
      used += key.length + (window.localStorage.getItem(key) ?? "").length;
    }
    return used;
  };
  // Storage with `room` characters left past what it holds now.
  const leave = (room: number) => capStorage(usedChars() + room);
  const studentTags = ["// student 1", "// student 2", "// student 3"];

  function mount() {
    const { result } = renderHook(() => useSourceFiles());
    return {
      files: () => result.current[0],
      count: () => result.current[2].count,
      save: (next: SourceFile[], how?: { load: boolean }) => {
        let written: unknown;
        act(() => {
          written = result.current[1](next, how);
        });
        return written;
      },
      restore: () => act(() => result.current[2].restore()),
    };
  }

  // Everything a restore offers that storage holds: the load's own copies,
  // then the backup.
  const kept = () => [...stored(COPIES), ...stored(BACKUP)];

  // What the page shows against what a reload finds. The last load's files
  // are restorable unless the load named them as replaced with no copy.
  function expectStored(
    h: ReturnType<typeof mount>,
    lastLoadReplaced: SourceFile[],
    unsaved: unknown,
  ) {
    expect(tags(stored(STORE)), "the student's current files are stored").toEqual(tags(h.files()));
    const named = unsaved as string[];
    expect(tags(kept()), "the last load's files are restorable").toEqual(
      expect.arrayContaining(tags(lastLoadReplaced.filter((f) => !named.includes(f.name)))),
    );
    expect(h.count(), "the restore count is what is stored").toBe(kept().length);
    const reloaded = mount();
    expect(tags(reloaded.files())).toEqual(tags(h.files()));
    expect(reloaded.count()).toBe(h.count());
  }

  // Another site's data leaves `room` characters: ten course-sized loads,
  // then the student adds a helper of their own. The backup key holds what
  // it always did: the student's files, which the same-named programs never
  // displace.
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
        const unsaved = h.save(
          ["stack.s", "queue.s", "utils.s"].map((n) => file(n, `program ${i} ${n}`, room / 20)),
          { load: true },
        );
        expectStored(h, replaced, unsaved);
        expect(tags(stored(BACKUP)), `the backup after load ${i}`).toEqual(studentTags);
      }
      // The copies give way to the student's new helper.
      h.save([...h.files(), file("t.s", "student T", room / 10)]);
      expect(tags(stored(STORE)), "the new helper is stored").toEqual(tags(h.files()));
      expect(tags(stored(BACKUP))).toEqual(studentTags);
    },
  );

  // Five links of four large helpers each, with a helper the student writes
  // before the fifth; then the student restores. Each link displaces every
  // file before it, so the backup key holds just those, as it always did.
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
        expectStored(h, replaced, h.save(link(k), { load: true }));
        expect(tags(stored(BACKUP)), `the backup after link ${k}`).toEqual(tags(replaced));
      }
      h.save([...h.files(), file("t.s", "student T", quota / 100)]);
      expectStored(h, replaced, []);
      replaced = h.files();
      expectStored(h, replaced, h.save(link(5), { load: true }));
      expect(tags(stored(BACKUP)), "the backup after link 5").toEqual(tags(replaced));

      const kept = tags([...h.files(), ...stored(BACKUP)]);
      h.restore();
      expect(tags(h.files())).toEqual(kept);
      expect(tags(stored(STORE)), "the restored files are stored").toEqual(kept);
      expect(stored(BACKUP)).toEqual([]);
      expect(h.count()).toBe(0);
    },
  );

  // A restore goes as it always did: the list is cleared, though a full
  // store does not take the restored strip.
  it("clears the stored list on a restore as before, though the strip does not fit", () => {
    window.localStorage.setItem(STORE, JSON.stringify([{ name: "mine.s", body: "// mine" }]));
    const h = mount();
    h.save([{ name: "zz.s", body: "// zz" }], { load: true });
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
    expect(tags(h.files())).toEqual(["// zz", "// mine"]);
    expect(stored(BACKUP)).toEqual([]);
    expect(tags(stored(STORE))).toEqual(["// zz"]);
    expect(h.count()).toBe(0);
    expect(mount().count()).toBe(0);
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

  // Room is made from copies of files that came with links, never from the
  // student's own.
  it("keeps the student's own helpers in the backup through loads that fill the store", () => {
    const student = [1, 2, 3].map((j) => file(`s${j}.s`, `student ${j}`, 1000));
    window.localStorage.setItem(STORE, JSON.stringify(student));
    const h = mount();
    leave(8000);
    for (let i = 1; i <= 6; i++) {
      h.save(
        ["stack.s", "queue.s", "utils.s"].map((n) => file(n, `program ${i} ${n}`, 1000)),
        { load: true },
      );
      expect(tags(stored(BACKUP)), `after load ${i}`).toEqual(expect.arrayContaining(studentTags));
      expect(tags(stored(STORE)), `the strip after load ${i}`).toEqual(tags(h.files()));
    }
  });

  // The copies do not fit beside the old strip, but do beside the smaller new one.
  it("stores a smaller program's strip and the copies of what it replaced", () => {
    window.localStorage.setItem(
      STORE,
      JSON.stringify([file("stack.s", "my stack", 2000), file("mine.s", "mine", 2000)]),
    );
    const h = mount();
    leave(3000);
    expect(h.save([file("stack.s", "example stack", 1000)], { load: true })).toEqual([]);
    expect(tags(stored(STORE))).toEqual(["// example stack"]);
    expect(tags(stored(BACKUP)), "the backup holds what the load displaced").toEqual(["// mine"]);
    expect(tags(kept()), "the student's files are stored").toEqual(["// my stack", "// mine"]);
    expect(h.count()).toBe(2);
  });

  // Closing a tab whose copy does not fit goes as it always did: the strip
  // is stored without it, and only this visit's list offers it back.
  it("closes a tab at a full store as before", () => {
    window.localStorage.setItem(
      STORE,
      JSON.stringify([file("a.s", "a", 500), file("big.s", "big", 3000)]),
    );
    window.localStorage.setItem(BACKUP, JSON.stringify([file("k.s", "k", 800)]));
    const h = mount();
    leave(200);
    h.save(h.files().filter((f) => f.name !== "big.s"));
    expect(tags(stored(STORE))).toEqual(["// a"]);
    expect(tags(stored(BACKUP)), "the stored list is as it was").toEqual(["// k"]);
    expect(h.count(), "the list offers the closed tab").toBe(1);
  });

  // Copies of a link's files may give way, so a strip the store has room for
  // lands as it would with no backup at all.
  it("stores a larger program over a link's helpers when only their copies do not fit", () => {
    const names = ["stack.s", "queue.s", "utils.s"];
    const h = mount();
    h.save(names.map((n) => file(n, `link ${n}`, 2000)), { load: true });
    leave(6500);
    h.save(names.map((n) => file(n, `larger ${n}`, 2300)), { load: true });
    expect(tags(stored(STORE))).toEqual(names.map((n) => `// larger ${n}`));
    expect(h.count(), "the restore count is what is stored").toBe(stored(BACKUP).length);
  });

  // Typing writes the strip as it always did; a full store refuses it, and
  // the backup is never made smaller to fit it.
  it("leaves the backup alone when typing meets a full store", () => {
    const student = [1, 2, 3].map((j) => file(`s${j}.s`, `student ${j}`, 1000));
    window.localStorage.setItem(STORE, JSON.stringify(student));
    const h = mount();
    h.save(
      ["stack.s", "queue.s", "utils.s"].map((n) => file(n, `program ${n}`, 1000)),
      { load: true },
    );
    leave(0);
    h.save(h.files().map((f) => (f.name === "stack.s" ? { ...f, body: `${f.body}${"z".repeat(25)}` } : f)));
    expect(tags(stored(BACKUP))).toEqual(studentTags);
    expect(h.count()).toBe(3);
  });

  // The copies give way whole, so typing lands wherever it always did and
  // the backup is what it always was.
  it("lets the copies go so that typing at a full store lands as before", () => {
    window.localStorage.setItem(STORE, JSON.stringify([file("mine.s", "mine", 1000)]));
    const h = mount();
    h.save([file("p.s", "link one", 1000)], { load: true });
    h.save([file("q.s", "link two", 1000)], { load: true });
    leave(0);
    h.save(h.files().map((f) => ({ ...f, body: `${f.body}${"z".repeat(25)}` })));
    expect(stored(STORE).map((f) => f.body), "the typing is stored").toEqual(
      h.files().map((f) => f.body),
    );
    expect(tags(stored(BACKUP))).toEqual(["// link one"]);
    expect(tags(kept())).toEqual(["// link one"]);
    expect(h.count()).toBe(1);
  });

  // A file back on the strip unchanged needs no copy, so alternating two
  // programs does not fill the restore list with copies of what is on screen.
  it("keeps no copy of a file a load puts back", () => {
    window.localStorage.setItem(STORE, JSON.stringify([file("s.s", "student", 100)]));
    const P = [file("p1.s", "P one", 100), file("p2.s", "P two", 100)];
    const Q = [file("q1.s", "Q one", 100), file("q2.s", "Q two", 100)];
    const h = mount();
    h.save(P, { load: true });
    h.save(Q, { load: true });
    h.save(P, { load: true });
    expect(tags(stored(BACKUP))).toEqual(["// Q one", "// Q two"]);
    expect(tags(kept())).toEqual(["// student", "// Q one", "// Q two"]);
    h.save(Q, { load: true });
    expect(tags(stored(BACKUP))).toEqual(["// P one", "// P two"]);
    expect(tags(kept())).toEqual(["// student", "// P one", "// P two"]);
    expect(h.count()).toBe(3);
  });

  // No room for copies of the student's files beside the new strip: the
  // load goes as it always did, and says which saved helpers it replaced
  // with no copy.
  it("loads a larger program as before when no copies fit beside it, and names them", () => {
    const names = ["stack.s", "queue.s", "utils.s"];
    window.localStorage.setItem(STORE, JSON.stringify(names.map((n) => file(n, `my ${n}`, 2000))));
    const h = mount();
    leave(6500);
    expect(h.save(names.map((n) => file(n, `link ${n}`, 2300)), { load: true })).toEqual(names);
    expect(tags(h.files())).toEqual(names.map((n) => `// link ${n}`));
    expect(tags(stored(STORE))).toEqual(names.map((n) => `// link ${n}`));
    expect(kept()).toEqual([]);
    expect(h.count()).toBe(0);
  });

  // Storage that takes no write: the load still goes, the list it displaced
  // is offered for this visit as it always was, and the saved helper is named.
  it("loads as before when storage takes no write, and names the saved helper", () => {
    window.localStorage.setItem(STORE, JSON.stringify([file("mine.s", "mine", 100)]));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage is full", "QuotaExceededError");
    });
    const h = mount();
    h.save([...h.files(), file("new.s", "new", 10)]);
    expect(h.save([file("l.s", "link", 10)], { load: true })).toEqual(["mine.s"]);
    expect(tags(h.files())).toEqual(["// link"]);
    expect(h.count()).toBe(2);
    expect(tags(stored(STORE))).toEqual(["// mine"]);
  });

  // Site data blocked outright: nothing is stored, so nothing stored can be
  // lost, and every load goes as it always did with nothing to name.
  it("loads as before, naming nothing, when the browser stores nothing for the site", () => {
    const blocked = () => {
      throw new DOMException("site data is blocked", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    const h = mount();
    h.save([file("new.s", "new", 10)]);
    expect(h.save([file("l.s", "link", 10)], { load: true })).toEqual([]);
    expect(tags(h.files())).toEqual(["// link"]);
    expect(h.save([], { load: true })).toEqual([]);
    expect(h.count(), "the list holds what the last load displaced").toBe(1);
    h.restore();
    expect(tags(h.files())).toEqual(["// link"]);
  });
});
