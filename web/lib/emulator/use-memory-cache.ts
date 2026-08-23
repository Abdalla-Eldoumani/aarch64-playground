"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { EmulatorBackend } from "@/lib/emulator/backend";

function memCacheKey(addr: number, len: number): string {
  return `${addr}:${len}`;
}

export interface MemoryCache {
  /**
   * Returns the cached bytes for `[addr, addr + len)`. On a cache miss
   * the returned array is empty and an async fetch is queued; the next
   * render delivers the bytes via state.
   */
  getMemory: (addr: number, len: number) => Uint8Array;
  /** Whether the range is mapped: true/false once known, null while the
   *  async verdict is in flight. */
  getMemoryMapped: (addr: number, len: number) => boolean | null;
  /** Drop every cached range and re-render the panels reading them. The
   *  hub calls this when the backend bumps `frame`, so no panel renders
   *  bytes belonging to a machine that has already moved on. */
  invalidate: () => void;
}

/**
 * The per-frame memory cache behind the memory and watch panels: a
 * synchronous read over an async backend. Both caches live in refs and
 * share one tick, because both are emptied by the same frame bump.
 */
export function useMemoryCache(
  backendRef: RefObject<EmulatorBackend | null>,
): MemoryCache {
  // Stores Uint8Arrays keyed by addr+len.
  const memCacheRef = useRef<Map<string, Uint8Array>>(new Map());
  const memPendingRef = useRef<Set<string>>(new Set());
  // Parallel mapped-ness cache for the watch panel's fault display;
  // same per-frame lifetime as the byte cache.
  const mappedCacheRef = useRef<Map<string, boolean>>(new Map());
  const mappedPendingRef = useRef<Set<string>>(new Set());
  // Tick increments whenever cache state changes so panels re-render.
  const [memTick, setMemTick] = useState(0);

  const invalidate = useCallback(() => {
    memCacheRef.current.clear();
    memPendingRef.current.clear();
    mappedCacheRef.current.clear();
    mappedPendingRef.current.clear();
    setMemTick((t) => t + 1);
  }, []);

  // Synchronous read from the per-frame cache. On a miss we kick off
  // an async fetch; the next snapshot/heartbeat will trigger a re-
  // render with the bytes available.
  const getMemory = useCallback(
    (addr: number, len: number): Uint8Array => {
      const backend = backendRef.current;
      if (!backend) return new Uint8Array(len);
      const key = memCacheKey(addr, len);
      const cached = memCacheRef.current.get(key);
      if (cached) return cached;
      if (!memPendingRef.current.has(key)) {
        memPendingRef.current.add(key);
        backend
          .getMemory(addr, len)
          .then((bytes) => {
            memCacheRef.current.set(key, bytes);
            memPendingRef.current.delete(key);
            setMemTick((t) => t + 1);
          })
          .catch(() => {
            memPendingRef.current.delete(key);
          });
      }
      return new Uint8Array(len);
    },
    // memTick included so React knows this callback closure should
    // re-fire on cache invalidation; not strictly required since the
    // cache lives in refs but keeps the dependency set honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memTick],
  );

  // Same sync-read-over-async-cache shape as getMemory: null means the
  // verdict has not arrived yet; the watch panel renders a pending
  // placeholder instead of a fake 0.
  const getMemoryMapped = useCallback(
    (addr: number, len: number): boolean | null => {
      const backend = backendRef.current;
      if (!backend) return null;
      const key = memCacheKey(addr, len);
      const cached = mappedCacheRef.current.get(key);
      if (cached !== undefined) return cached;
      if (!mappedPendingRef.current.has(key)) {
        mappedPendingRef.current.add(key);
        backend
          .isRangeMapped(addr, len)
          .then((mapped) => {
            mappedCacheRef.current.set(key, mapped);
            mappedPendingRef.current.delete(key);
            setMemTick((t) => t + 1);
          })
          .catch(() => {
            mappedPendingRef.current.delete(key);
          });
      }
      return null;
    },
    // Same honest-dependency note as getMemory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memTick],
  );

  return { getMemory, getMemoryMapped, invalidate };
}
