/**
 * The emulator's memory regions, as the memory panel labels them. The table
 * comes from the wasm module (`memoryMap`) so the Rust constants stay the only
 * copy; this file has no wasm import, so panels and tests can use it directly.
 */

export interface MemoryRegion {
  /** Region name as the panel shows it (".data", "stack", ...). */
  name: string;
  start: number;
  /** First address past the region, as the Rust side builds it (base + size). */
  end: number;
}

/**
 * Drop malformed rows, which would label addresses `undefined`. Both backends
 * call this, so the worker and main-thread paths give the same table.
 */
export function normalizeMemoryMap(raw: unknown): MemoryRegion[] {
  if (!Array.isArray(raw)) return [];
  const regions: MemoryRegion[] = [];
  for (const row of raw as Array<Partial<MemoryRegion>>) {
    if (typeof row?.name !== "string") continue;
    if (!Number.isFinite(row.start) || !Number.isFinite(row.end)) continue;
    regions.push({ name: row.name, start: Number(row.start), end: Number(row.end) });
  }
  return regions;
}

/**
 * The region holding `addr`, or null in a gap between regions or when the
 * table is empty (an older wasm build without the export).
 */
export function regionFor(
  addr: number,
  regions: readonly MemoryRegion[],
): MemoryRegion | null {
  for (const region of regions) {
    if (addr >= region.start && addr < region.end) return region;
  }
  return null;
}
