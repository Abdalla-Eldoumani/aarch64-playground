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
 * Everything a program needs on the machine besides its text. Assembling
 * resets the machine, files and stdin included, so every write goes through
 * stageVfsFile / removeVfsFile to keep the record assemble puts back.
 *
 * On the full playground (`isHome`) the files are the student's home
 * directory, saved in IndexedDB; a program's fixtures land beside them (over
 * any with the same name), and stdin seeds are dropped so a program that reads
 * input waits for the student instead of answering its own scanf after every
 * assemble. Embeds and checkers keep their seeds and replace the files
 * outright: a lesson figure must see exactly its own fixtures.
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
