/**
 * Hard caps and validators for every untrusted-input ingress. The
 * emulator's VFS lives in a `HashMap<String, Vec<u8>>` inside WASM linear
 * memory, and decoded URL state is attacker-controlled via a shared link;
 * an unbounded paste, upload, or share fragment can wedge or exhaust the
 * tab. The caps are sized for the cpsc 355 corpus (typical inputs are
 * < 10 KB) with generous headroom.
 */

/** 1 MB cap on pasted / imported / dropped source. */
export const MAX_SOURCE_BYTES = 1 * 1024 * 1024;
/**
 * 4 MiB cap on raw VFS payloads (terminal upload + console upload).
 * Matches the emulator's own whole-VFS wall (`syscalls::MAX_VFS_TOTAL_BYTES`),
 * which is sized against the step-back ring cloning the VFS every step;
 * a larger upload would be refused by the machine it is headed for.
 */
export const MAX_VFS_BYTES = 4 * 1024 * 1024;
/** 1000-character cap on command-line arguments. */
export const MAX_ARGS_CHARS = 1000;
/** 100 KB cap on a single stdin submission. */
export const MAX_STDIN_BYTES = 100 * 1024;
/** 1 MB cap on bookmark JSON imports. */
export const MAX_BOOKMARK_JSON_BYTES = 1 * 1024 * 1024;
/**
 * Files a `.json` workspace bundle may carry (main.asm plus helpers). The
 * largest course program shipped here splits across 18; 32 leaves room
 * without letting a hand-written bundle open a hundred tabs.
 */
export const MAX_WORKSPACE_FILES = 32;
/** Maximum decompressed size of a `?bundle=` deep link (1 MB). */
export const MAX_BUNDLE_DECOMPRESSED_BYTES = 1 * 1024 * 1024;
/** Maximum decompressed size of a `#p2=` share hash (1 MB). */
export const MAX_SHARE_DECOMPRESSED_BYTES = 1 * 1024 * 1024;
/**
 * 12 KB cap on a raw (still-compressed) URL-borne fragment: the `#p2=` /
 * `#p=` share hash and the `?bundle=` deep link. lz-string output grows
 * QUADRATICALLY in fragment length for a crafted payload (measured:
 * fragment ~ 3 * sqrt(chars-out), so a 30 KB fragment inflated to ~100M
 * chars / ~200 MB), which a raw-length cap alone cannot bound linearly.
 * At 12 KB the worst case is ~16M chars (~33 MB transient), freed the
 * moment the post-decode 1 MB ceiling rejects it -- a hiccup, not a
 * tab-killer. Legitimate course programs compress to well under 4 KB.
 */
export const MAX_SHARE_HASH_BYTES = 12 * 1024;

const encoder = new TextEncoder();

/** UTF-8 byte length of a string, for byte-based caps. */
function byteLength(text: string): number {
  return encoder.encode(text).length;
}

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

/**
 * Returns null when the source is within `MAX_SOURCE_BYTES` (measured in
 * UTF-8 bytes), otherwise a toast-ready error string.
 */
export function validateSource(text: string): string | null {
  if (byteLength(text) <= MAX_SOURCE_BYTES) return null;
  const limitMb = (MAX_SOURCE_BYTES / (1024 * 1024)).toFixed(0);
  return `source too large (max ${limitMb} MB)`;
}

/**
 * Returns null when the args are within `MAX_ARGS_CHARS` (measured in
 * characters, since args are parsed shell-style as text), otherwise a
 * toast-ready error string.
 */
export function validateArgs(text: string): string | null {
  if (text.length <= MAX_ARGS_CHARS) return null;
  return `arguments too long (max ${MAX_ARGS_CHARS} characters)`;
}

/**
 * Returns null when the stdin is within `MAX_STDIN_BYTES` (measured in
 * UTF-8 bytes), otherwise a toast-ready error string.
 */
export function validateStdin(text: string): string | null {
  if (byteLength(text) <= MAX_STDIN_BYTES) return null;
  const limitKb = (MAX_STDIN_BYTES / 1024).toFixed(0);
  return `stdin too large (max ${limitKb} KB)`;
}
