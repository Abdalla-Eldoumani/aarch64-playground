// The seeds and the working file set: what has to go back on the machine
// after an assemble wipes it, and how the full playground's home directory
// differs from the sandboxes. The persistence module is mocked here; its own
// IndexedDB behavior is pinned in vfs-persist.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const persistMock = vi.hoisted(() => ({
  loadPersistedVfs: vi.fn(async (): Promise<Record<string, string> | null> => null),
  savePersistedVfs: vi.fn(async () => {}),
}));
vi.mock("@/lib/playground/vfs-persist", () => persistMock);

import {
  useWorkingSet,
  type WorkingSet,
  type WorkingSetMachine,
} from "@/lib/playground/use-working-set";

function makeMachine(): WorkingSetMachine {
  return {
    pushStdin: vi.fn(),
    uploadVfsFile: vi.fn(),
    deleteVfsFile: vi.fn(async () => true),
  };
}

/** Names and bodies delivered to the machine, in call order. */
function uploads(machine: WorkingSetMachine): Array<[string, string]> {
  return vi
    .mocked(machine.uploadVfsFile)
    .mock.calls.map(([name, data]) => [name, new TextDecoder().decode(data)]);
}

function setup(opts: {
  isHome: boolean;
  startStdin?: string;
  machineLoaded?: boolean;
}) {
  const machine = makeMachine();
  const rendered = renderHook(
    (props: { machineLoaded: boolean }) =>
      useWorkingSet({
        isHome: opts.isHome,
        startStdin: opts.startStdin,
        machine: { current: machine },
        machineLoaded: props.machineLoaded,
      }),
    { initialProps: { machineLoaded: opts.machineLoaded ?? true } },
  );
  const set = () => rendered.result.current as WorkingSet;
  return { machine, set, rendered };
}

beforeEach(() => {
  persistMock.loadPersistedVfs.mockImplementation(async () => null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the stdin seed", () => {
  it("re-feeds an authored seed on every assemble in a sandbox surface", () => {
    const { machine, set } = setup({ isHome: false, startStdin: "42\n" });
    act(() => set().applySeeds());
    act(() => set().applySeeds());
    expect(machine.pushStdin).toHaveBeenNthCalledWith(1, "42\n");
    expect(machine.pushStdin).toHaveBeenNthCalledWith(2, "42\n");
  });

  it("drops it in the full playground, so a reading program blocks at the read", () => {
    // Seeding here re-fed the boot's stdin after every assemble, and a
    // hard-loaded share link answered its own scanf forever.
    const { machine, set } = setup({ isHome: true, startStdin: "42\n" });
    act(() => set().applySeeds());
    expect(machine.pushStdin).not.toHaveBeenCalled();
  });

  it("pushes nothing when the program has no seed", () => {
    const { machine, set } = setup({ isHome: false });
    act(() => set().applySeeds());
    expect(machine.pushStdin).not.toHaveBeenCalled();
  });
});

describe("a program handoff's files", () => {
  it("lands beside the home directory, with the program winning a name collision", () => {
    const { machine, set } = setup({ isHome: true });
    act(() => set().stageVfsFile("mine.txt", "student file"));
    act(() =>
      set().seedFromPayload({
        vfs: { "numbers.txt": "1 2 3\n", "mine.txt": "fixture wins" },
      }),
    );
    const delivered = uploads(machine);
    expect(delivered).toContainEqual(["numbers.txt", "1 2 3\n"]);
    expect(delivered).toContainEqual(["mine.txt", "fixture wins"]);
    // The merged map, not just the payload, is what a later assemble restores.
    vi.mocked(machine.uploadVfsFile).mockClear();
    act(() => set().applySeeds());
    expect(uploads(machine).sort()).toEqual([
      ["mine.txt", "fixture wins"],
      ["numbers.txt", "1 2 3\n"],
    ]);
  });

  it("replaces the file set strictly in a sandbox surface", () => {
    // A lesson figure must see exactly its own fixtures, never a leftover.
    const { machine, set } = setup({ isHome: false });
    act(() => set().stageVfsFile("leftover.txt", "from the last figure"));
    act(() => set().seedFromPayload({ vfs: { "figure.txt": "only me" } }));
    vi.mocked(machine.uploadVfsFile).mockClear();
    act(() => set().applySeeds());
    expect(uploads(machine)).toEqual([["figure.txt", "only me"]]);
  });

  it("keeps the payload's stdin in a sandbox and drops it at home", () => {
    const sandbox = setup({ isHome: false });
    act(() => sandbox.set().seedFromPayload({ stdin: "7\n" }));
    act(() => sandbox.set().applySeeds());
    expect(sandbox.machine.pushStdin).toHaveBeenCalledWith("7\n");

    const home = setup({ isHome: true });
    act(() => home.set().seedFromPayload({ stdin: "7\n" }));
    act(() => home.set().applySeeds());
    expect(home.machine.pushStdin).not.toHaveBeenCalled();
  });

  it("seeds the files immediately, so the console's file list shows them", () => {
    const { machine, set } = setup({ isHome: true });
    act(() => set().seedFromPayload({ vfs: { "input.txt": "data\n" } }));
    expect(uploads(machine)).toEqual([["input.txt", "data\n"]]);
  });
});

describe("the user write paths", () => {
  it("stages a string write into the machine and the record", () => {
    const { machine, set } = setup({ isHome: true });
    act(() => set().stageVfsFile("lab5.s", "mov x0, 0\n"));
    expect(uploads(machine)).toEqual([["lab5.s", "mov x0, 0\n"]]);
    vi.mocked(machine.uploadVfsFile).mockClear();
    act(() => set().applySeeds());
    expect(uploads(machine)).toEqual([["lab5.s", "mov x0, 0\n"]]);
  });

  it("stages an uploaded byte array the same way", () => {
    const { machine, set } = setup({ isHome: true });
    const bytes = new TextEncoder().encode("binary-ish\n");
    act(() => set().stageVfsFile("data.bin", bytes));
    expect(vi.mocked(machine.uploadVfsFile).mock.calls[0][1]).toBe(bytes);
    vi.mocked(machine.uploadVfsFile).mockClear();
    act(() => set().applySeeds());
    expect(uploads(machine)).toEqual([["data.bin", "binary-ish\n"]]);
  });

  it("forgets a removed file and reports the machine's verdict", async () => {
    const { machine, set } = setup({ isHome: true });
    act(() => set().stageVfsFile("a.txt", "1"));
    act(() => set().stageVfsFile("b.txt", "2"));
    let removed: boolean | undefined;
    await act(async () => {
      removed = await set().removeVfsFile("a.txt");
    });
    expect(removed).toBe(true);
    expect(machine.deleteVfsFile).toHaveBeenCalledWith("a.txt");
    vi.mocked(machine.uploadVfsFile).mockClear();
    act(() => set().applySeeds());
    expect(uploads(machine)).toEqual([["b.txt", "2"]]);
  });

  it("still reports a delete the machine refused", async () => {
    const { machine, set } = setup({ isHome: true });
    vi.mocked(machine.deleteVfsFile).mockResolvedValue(false);
    let removed: boolean | undefined;
    await act(async () => {
      removed = await set().removeVfsFile("gone.txt");
    });
    expect(removed).toBe(false);
  });
});

describe("mirroring to the store", () => {
  it("writes the whole working set after every home-surface write", async () => {
    const { set } = setup({ isHome: true });
    act(() => set().stageVfsFile("a.txt", "1"));
    await waitFor(() =>
      expect(persistMock.savePersistedVfs).toHaveBeenLastCalledWith({ "a.txt": "1" }),
    );
    act(() => set().stageVfsFile("b.txt", "2"));
    await waitFor(() =>
      expect(persistMock.savePersistedVfs).toHaveBeenLastCalledWith({
        "a.txt": "1",
        "b.txt": "2",
      }),
    );
    await act(async () => {
      await set().removeVfsFile("a.txt");
    });
    await waitFor(() =>
      expect(persistMock.savePersistedVfs).toHaveBeenLastCalledWith({ "b.txt": "2" }),
    );
  });

  it("never touches the store from a sandbox surface", async () => {
    const { set } = setup({ isHome: false });
    act(() => set().stageVfsFile("a.txt", "1"));
    act(() => set().seedFromPayload({ vfs: { "b.txt": "2" } }));
    await act(async () => {
      await set().removeVfsFile("a.txt");
    });
    act(() => set().persistWorkingSet());
    expect(persistMock.savePersistedVfs).not.toHaveBeenCalled();
    expect(persistMock.loadPersistedVfs).not.toHaveBeenCalled();
  });
});

describe("rehydrating the home directory", () => {
  it("loads the persisted files onto the machine once the hub is live", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "notes.txt": "keep me\n",
    }));
    const { machine } = setup({ isHome: true });
    await waitFor(() =>
      expect(uploads(machine)).toContainEqual(["notes.txt", "keep me\n"]),
    );
  });

  it("waits for the hub, then hydrates exactly once", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "notes.txt": "keep me\n",
    }));
    const { machine, rendered } = setup({ isHome: true, machineLoaded: false });
    expect(persistMock.loadPersistedVfs).not.toHaveBeenCalled();
    rendered.rerender({ machineLoaded: true });
    await waitFor(() => expect(persistMock.loadPersistedVfs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(uploads(machine).length).toBe(1));
    rendered.rerender({ machineLoaded: true });
    expect(persistMock.loadPersistedVfs).toHaveBeenCalledTimes(1);
  });

  it("sits underneath whatever a boot handoff already staged", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({
      "shared.txt": "the stored copy",
      "old.txt": "still here",
    }));
    const { machine, set } = setup({ isHome: true });
    // The link's fixtures land before the store's read resolves.
    act(() => set().seedFromPayload({ vfs: { "shared.txt": "the link's copy" } }));
    await waitFor(() => expect(uploads(machine)).toContainEqual(["old.txt", "still here"]));
    vi.mocked(machine.uploadVfsFile).mockClear();
    act(() => set().applySeeds());
    expect(uploads(machine).sort()).toEqual([
      ["old.txt", "still here"],
      ["shared.txt", "the link's copy"],
    ]);
  });

  it("uploads nothing when the store is empty or unavailable", async () => {
    persistMock.loadPersistedVfs.mockImplementation(async () => ({}));
    const empty = setup({ isHome: true });
    await waitFor(() => expect(persistMock.loadPersistedVfs).toHaveBeenCalled());
    expect(empty.machine.uploadVfsFile).not.toHaveBeenCalled();

    persistMock.loadPersistedVfs.mockImplementation(async () => null);
    const unavailable = setup({ isHome: true });
    await waitFor(() => expect(persistMock.loadPersistedVfs).toHaveBeenCalledTimes(2));
    expect(unavailable.machine.uploadVfsFile).not.toHaveBeenCalled();
  });

  it("never reads the store from a sandbox surface", async () => {
    setup({ isHome: false });
    await Promise.resolve();
    expect(persistMock.loadPersistedVfs).not.toHaveBeenCalled();
  });
});
