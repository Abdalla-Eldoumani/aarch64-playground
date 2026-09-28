/**
 * Size caps for everything a student or a shared link can feed in: one
 * unbounded paste, upload, or link can freeze or crash the tab. Course
 * inputs are under 10 KB, so the caps leave plenty of room.
 */

/** Pasted, imported, or dropped source. */
export const MAX_SOURCE_BYTES = 1 * 1024 * 1024;
/** Uploads. Matches the emulator's cap on all its files together
 *  (`syscalls::MAX_VFS_TOTAL_BYTES`), which would refuse anything larger. */
export const MAX_VFS_BYTES = 4 * 1024 * 1024;
export const MAX_ARGS_CHARS = 1000;
/** One stdin submission. */
export const MAX_STDIN_BYTES = 100 * 1024;
export const MAX_BOOKMARK_JSON_BYTES = 1 * 1024 * 1024;
/** The largest shipped program has 18 files; 32 leaves room without letting
 *  a hand-written workspace bundle open a hundred tabs. */
export const MAX_WORKSPACE_FILES = 32;
export const MAX_BUNDLE_DECOMPRESSED_BYTES = 1 * 1024 * 1024;
export const MAX_SHARE_DECOMPRESSED_BYTES = 1 * 1024 * 1024;
/**
 * Cap on a link payload before it is decompressed (`#p2=`, `#p=`, `?bundle=`).
 * A crafted payload inflates with the square of its length (30 KB became
 * ~200 MB), so the length is capped first. At 12 KB the worst case is ~33 MB,
 * freed as soon as the 1 MiB decoded cap rejects it. Course programs compress
 * to well under 4 KB.
 */
export const MAX_SHARE_HASH_BYTES = 12 * 1024;

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/** Each check returns null when within its cap, else a message ready for a toast. */
export function checkUploadSize(
  bytes: number,
  cap: number,
  label: string,
): string | null {
  if (bytes <= cap) return null;
  const limitMb = (cap / (1024 * 1024)).toFixed(0);
  return `${label} too large: the limit is ${limitMb} MiB`;
}

export function validateSource(text: string): string | null {
  if (byteLength(text) <= MAX_SOURCE_BYTES) return null;
  const limitMb = (MAX_SOURCE_BYTES / (1024 * 1024)).toFixed(0);
  return `source too large: the limit is ${limitMb} MiB`;
}

/** Characters, not bytes: args are parsed as text, shell-style. */
export function validateArgs(text: string): string | null {
  if (text.length <= MAX_ARGS_CHARS) return null;
  return `arguments too long (max ${MAX_ARGS_CHARS} characters)`;
}

export function validateStdin(text: string): string | null {
  if (byteLength(text) <= MAX_STDIN_BYTES) return null;
  const limitKb = (MAX_STDIN_BYTES / 1024).toFixed(0);
  return `stdin too large: the limit is ${limitKb} KiB`;
}
