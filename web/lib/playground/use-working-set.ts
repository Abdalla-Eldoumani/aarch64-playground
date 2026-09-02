"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { loadPersistedVfs, savePersistedVfs } from "@/lib/playground/vfs-persist";

/** The slice of the emulator hub the working set drives. */
export type WorkingSetMachine = {
  pushStdin: (text: string) => void;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  deleteVfsFile: (path: string) => Promise<boolean>;
};

/** A program's input seeds: what assemble's machine reset has to put back. */
export type InputSeeds = {
  stdin?: string;
  vfs?: Record<string, string>;
};

export type WorkingSet = {
  /** Re-apply the seeds after an assemble (which resets the whole machine). */
  applySeeds: () => void;
  /** Mirror the working file set into the store, if this surface has one. */
  persistWorkingSet: () => void;
  /** The one write path for a user-created file (upload, redirect, fixture). */
  stageVfsFile: (name: string, data: Uint8Array | string) => void;
  removeVfsFile: (path: string) => Promise<boolean>;
  /** Install a program handoff's inputs as the seeds every later assemble
   *  re-applies, seeding its files onto the machine now. */
  seedFromPayload: (payload: InputSeeds) => void;
};

/**
 * The input seeds and the working file set: everything a program needs on the
 * machine that is not the program text.
 *
 * Assembling resets the whole machine, stdin queue and VFS included, so the
 * seeds are the record of what has to go back afterwards. Routing every user
 * write through `stageVfsFile` / `removeVfsFile` keeps that record
 * authoritative, which buys two behaviors at once: assemble's reset re-seeds
 * the files instead of losing them, and a home surface mirrors the map into
 * IndexedDB so it survives reloads and route changes.
 *
 * `isHome` is the full playground: the VFS there is the student's home
 * directory, so a program's fixtures land BESIDE (and on name collisions, over)
 * the files already present, the map is persisted, and stdin seeds are dropped
 * on purpose: a program that reads input should block at the read and pull the
 * student to the console, and seeding here re-fed the boot's stdin after every
 * assemble, so a hard-loaded share or bundle link answered its own scanf
 * forever while the same link opened by in-app navigation did not. Embed and
 * checker surfaces are session-only sandboxes that keep their authored seeds
 * and replace the VFS strictly: a lesson figure must see exactly its own
 * fixtures.
 */
export function useWorkingSet(opts: {
  isHome: boolean;
  startStdin: string | undefined;
  machine: RefObject<WorkingSetMachine>;
  /** The hub is live; hydration cannot upload before it is. */
  machineLoaded: boolean;
}): WorkingSet {
  const { isHome, machine, machineLoaded } = opts;
  const seedsRef = useRef<InputSeeds>({
    stdin: isHome ? undefined : opts.startStdin,
  });

  const uploadAll = useCallback(
    (files: Record<string, string>) => {
      const enc = new TextEncoder();
      for (const [name, body] of Object.entries(files)) {
        machine.current.uploadVfsFile(name, enc.encode(body));
      }
    },
    [machine],
  );

  const applySeeds = useCallback(() => {
    const seeds = seedsRef.current;
    if (seeds.stdin) machine.current.pushStdin(seeds.stdin);
    if (seeds.vfs) uploadAll(seeds.vfs);
  }, [machine, uploadAll]);

  const persistWorkingSet = useCallback(() => {
    if (!isHome) return;
    void savePersistedVfs(seedsRef.current.vfs ?? {});
  }, [isHome]);

  const stageVfsFile = useCallback(
    (name: string, data: Uint8Array | string) => {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const body = typeof data === "string" ? data : new TextDecoder().decode(data);
      seedsRef.current.vfs = { ...(seedsRef.current.vfs ?? {}), [name]: body };
      machine.current.uploadVfsFile(name, bytes);
      persistWorkingSet();
    },
    [machine, persistWorkingSet],
  );

  const removeVfsFile = useCallback(
    async (path: string) => {
      if (seedsRef.current.vfs && path in seedsRef.current.vfs) {
        const next = { ...seedsRef.current.vfs };
        delete next[path];
        seedsRef.current.vfs = next;
      }
      const removed = await machine.current.deleteVfsFile(path);
      persistWorkingSet();
      return removed;
    },
    [machine, persistWorkingSet],
  );

  const seedFromPayload = useCallback(
    (payload: InputSeeds) => {
      const workingVfs = isHome
        ? { ...(seedsRef.current.vfs ?? {}), ...(payload.vfs ?? {}) }
        : payload.vfs;
      seedsRef.current = {
        stdin: isHome ? undefined : payload.stdin,
        vfs: workingVfs,
      };
      // Seed the VFS now so the console's file list shows the program's
      // fixtures immediately; assemble re-seeds after its machine reset.
      if (workingVfs) uploadAll(workingVfs);
      persistWorkingSet();
    },
    [isHome, persistWorkingSet, uploadAll],
  );

  // Rehydrate the home directory once the hub is live: the persisted files
  // sit underneath anything a boot handoff (share link, bundle, example)
  // already staged, so a link's fixtures win their name collisions. Runs
  // once per mount; embed and checker chromes never touch the store.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!isHome || hydratedRef.current || !machineLoaded) return;
    hydratedRef.current = true;
    void loadPersistedVfs().then((files) => {
      if (!files || Object.keys(files).length === 0) return;
      seedsRef.current.vfs = { ...files, ...(seedsRef.current.vfs ?? {}) };
      uploadAll(seedsRef.current.vfs);
    });
  }, [isHome, machineLoaded, uploadAll]);

  return {
    applySeeds,
    persistWorkingSet,
    stageVfsFile,
    removeVfsFile,
    seedFromPayload,
  };
}
