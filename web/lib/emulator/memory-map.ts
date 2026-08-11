/**
 * The emulator's address bands, as the memory panel labels them.
 *
 * The table itself is exported by the wasm module (`memoryMap`), so the
 * loader's section bases, the heap window, the stack band, and the host-stub
 * range are described in exactly one place: a panel that hardcoded them
 * would keep labelling addresses after the Rust constants moved. This module
 * holds the shape and the lookup only -- no wasm import, so it stays a pure
 * helper the panels and their tests can use directly.
 *
 * Bands are half-open `[start, end)`: `end` is the first address that is NOT
 * in the region, which is how the Rust side builds them (base + window).
 */

export interface MemoryRegion {
  /** Section or band name as the panel shows it (".data", "stack", ...). */
  name: string;
  /** First address in the band. */
  start: number;
  /** First address past the band. */
  end: number;
}

/**
 * Shape-check wasm rows before the panels index them: the map crosses the
 * boundary as a serialized array, and a malformed row would have the panel
 * labelling addresses with `undefined`. Both backends normalize here, so the
 * worker and main-thread paths deliver the same table.
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
 * The band containing `addr`, or null when the address falls in a gap
 * between bands (or the table is empty, which is what an older wasm build
 * without the export reports).
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
