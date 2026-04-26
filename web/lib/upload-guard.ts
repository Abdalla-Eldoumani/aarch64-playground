/**
 * Hard caps for browser-side file ingest. The emulator's VFS lives in
 * a `HashMap<String, Vec<u8>>` inside WASM linear memory; large uploads
 * can wedge the tab. The caps are sized for the cpsc 355 corpus
 * (typical inputs are < 10 KB) with generous headroom.
 */

/** 4 MB cap on .asm / .s / .txt source uploads. */
export const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
/** 16 MB cap on raw VFS payloads (terminal upload + console upload). */
export const MAX_VFS_BYTES = 16 * 1024 * 1024;
/** 1 MB cap on bookmark JSON imports. */
export const MAX_BOOKMARK_JSON_BYTES = 1 * 1024 * 1024;
/** Maximum decompressed size of a `?bundle=` deep link (1 MB). */
export const MAX_BUNDLE_DECOMPRESSED_BYTES = 1 * 1024 * 1024;
/** Maximum decompressed size of a `#p2=` share hash (1 MB). */
export const MAX_SHARE_DECOMPRESSED_BYTES = 1 * 1024 * 1024;
/** Maximum C source length the /api/c-to-asm route will forward to Godbolt (256 KB). */
export const MAX_C_SOURCE_BYTES = 256 * 1024;
/** Hard timeout on the upstream Godbolt request (30 s). */
export const C_TO_ASM_TIMEOUT_MS = 30_000;

/**
 * Returns null when the size is within `cap`, otherwise a human-readable
 * error string the call site can pass straight into a toast.
 */
export function checkUploadSize(
  bytes: number,
  cap: number,
  label: string,
): string | null {
  if (bytes <= cap) return null;
  const limitMb = (cap / (1024 * 1024)).toFixed(0);
  return `${label} too large (max ${limitMb} MB)`;
}
