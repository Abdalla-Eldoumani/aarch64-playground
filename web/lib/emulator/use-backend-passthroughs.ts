"use client";

import { useCallback, type RefObject } from "react";
import type { EmulatorBackend } from "@/lib/emulator/backend";
import type { AssemblyError } from "@/lib/emulator/emulator-state";

export interface BackendPassthroughs {
  pushStdin: (s: string, interactive?: boolean) => void;
  closeStdin: () => void;
  setSnapshotsPaused: (paused: boolean) => void;
  lint: (source: string) => Promise<AssemblyError[]>;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  readVfsFile: (path: string) => Promise<Uint8Array>;
  deleteVfsFile: (path: string) => Promise<boolean>;
  resolveLabel: (name: string) => Promise<number | null>;
  m4Expand: (
    source: string,
  ) => Promise<{ success: boolean; text?: string; error?: string; error_line?: number } | null>;
  saveState: (name: string) => void;
  deleteState: (name: string) => void;
}

/**
 * The parts of the hook's surface that are only the backend with a
 * null guard in front: stdin, the VFS, saved machine states, and the
 * tool queries. They keep no state of their own -- every result they
 * produce reaches React through the snapshot listener -- so they are
 * grouped rather than scattered through the hub. Anything that has to
 * touch hub state (loadState reopening the program gate, clearConsole
 * emptying the scrollback) belongs to its own cluster instead.
 */
export function useBackendPassthroughs(
  backendRef: RefObject<EmulatorBackend | null>,
): BackendPassthroughs {
  // `interactive` is the console box's typed line, which the machine echoes
  // as a read consumes it. Every other caller is a redirect (seeds, a `<`
  // file, the terminal pane, which already echoes what it drew) and leaves
  // it off.
  const pushStdin = useCallback(
    (s: string, interactive?: boolean) => {
      const backend = backendRef.current;
      if (!backend) return;
      void backend.pushStdin(s, interactive);
    },
    [backendRef],
  );

  const closeStdin = useCallback(() => {
    const backend = backendRef.current;
    if (!backend) return;
    void backend.closeStdin();
  }, [backendRef]);

  // Live terminal sessions pause the step-back ring: the per-step clone
  // costs more than the step, and stepping back mid-session has no
  // meaning. The drive resumes it when it stands down.
  const setSnapshotsPaused = useCallback(
    (paused: boolean) => {
      const backend = backendRef.current;
      if (!backend) return;
      void backend.setSnapshotsPaused(paused);
    },
    [backendRef],
  );

  const lint = useCallback(
    async (source: string): Promise<AssemblyError[]> => {
      const backend = backendRef.current;
      if (!backend) return [];
      try {
        return await backend.lint(source);
      } catch {
        // Advisory only: a lint failure must never surface as a problem.
        return [];
      }
    },
    [backendRef],
  );

  const uploadVfsFile = useCallback(
    (path: string, data: Uint8Array) => {
      const backend = backendRef.current;
      if (!backend) return;
      void backend.uploadVfsFile(path, data);
    },
    [backendRef],
  );

  const readVfsFile = useCallback(
    async (path: string) => {
      const backend = backendRef.current;
      if (!backend) return new Uint8Array();
      return backend.readVfsFile(path);
    },
    [backendRef],
  );

  const deleteVfsFile = useCallback(
    async (path: string) => {
      const backend = backendRef.current;
      if (!backend) return false;
      const result = await backend.deleteVfsFile(path);
      return result.removed;
    },
    [backendRef],
  );

  const resolveLabel = useCallback(
    async (name: string) => {
      const backend = backendRef.current;
      if (!backend) return null;
      return backend.resolveLabel(name);
    },
    [backendRef],
  );

  const m4Expand = useCallback(
    async (source: string) => {
      const backend = backendRef.current;
      if (!backend) return null;
      return backend.m4Expand(source);
    },
    [backendRef],
  );

  const saveState = useCallback(
    (name: string) => {
      const backend = backendRef.current;
      if (!backend || !name) return;
      void backend.saveState(name);
    },
    [backendRef],
  );

  const deleteState = useCallback(
    (name: string) => {
      const backend = backendRef.current;
      if (!backend) return;
      void backend.deleteState(name);
    },
    [backendRef],
  );

  return {
    pushStdin,
    closeStdin,
    setSnapshotsPaused,
    lint,
    uploadVfsFile,
    readVfsFile,
    deleteVfsFile,
    resolveLabel,
    m4Expand,
    saveState,
    deleteState,
  };
}
