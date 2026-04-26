# Security posture

This is a 100% client-side application: every byte of the emulator
lives in your tab. We still take a defensive stance because the
playground accepts URL-borne input (share hashes, diagnostic-bundle
deep links, query params) and file uploads (source files, VFS
payloads, bookmark JSON), all of which arrive untrusted.

## Threat model in two sentences

1. **An attacker cannot persist state** -- there is no server-side
   data store. The only data persisted is per-browser localStorage
   under the `aarch64-playground:*` key prefix.
2. **An attacker can craft a URL or file that the user opens.** The
   playground must not crash, hang, or run unintended code in
   response to any deep-link payload or file upload.

## What's enforced

### HTTP response headers (`vercel.json`)

| Header                       | Value                                         | Why                                                                                                  |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | tight default-src 'self', see vercel.json     | Blocks inline scripts from URL params, blocks third-party scripts except `cdn.jsdelivr.net` (Monaco) |
| `X-Content-Type-Options`     | `nosniff`                                     | Prevents MIME-sniff-driven script execution                                                          |
| `X-Frame-Options`            | `DENY`                                        | Blocks framing                                                                                       |
| `Cross-Origin-Opener-Policy` | `same-origin`                                 | Cross-origin isolation (windows opened cannot script us)                                             |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`             | Limits referer leakage                                                                                |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=()`    | Disables sensors we never request                                                                    |
| `Cache-Control`              | immutable for static + WASM, no-cache for sw  | Updates land instantly via `/sw.js` not being cached                                                  |

### Input validation gates

Every URL-borne or file-borne payload runs through a typed validator
before any of its fields touch React state, the editor, or the WASM
emulator.

| Surface                        | Validator                                  | What it rejects                                                  |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------- |
| `?bundle=<lz>` deep link       | `lib/diagnostic-bundle.ts::decodeBundle`   | non-version-1 payloads, malformed field types, > 1 MB inflated  |
| `#p2=<lz>` share hash          | `lib/share.ts::readShareHash`              | non-string source, malformed cursor, > 1 MB inflated             |
| `?example=<id>`                | regex `/^[\w.-]+$/`                        | path traversal, special chars                                    |
| `?theme=`, `?view=`            | enum check                                 | unknown values                                                   |
| Bookmark JSON import           | `lib/named-saves.ts::isValidSave`          | per-field type check, no-clobber on name collision               |
| `.s` / `.asm` / `.txt` upload  | `lib/upload-guard.ts` + `MAX_SOURCE_BYTES` | files > 4 MB                                                      |
| VFS upload (console + terminal)| `lib/upload-guard.ts` + `MAX_VFS_BYTES`    | files > 16 MB                                                     |
| Bookmark JSON upload           | `lib/upload-guard.ts` + `MAX_BOOKMARK_JSON_BYTES` | files > 1 MB                                                |

### Practices we follow

- **No raw HTML injection anywhere** -- everything Monaco shows is via
  its own typed APIs. The diagnostic-bundle markdown is written to
  the clipboard, never injected into the DOM.
- **No dynamic JS evaluation** -- the watch-expression evaluator
  parses by hand into a small AST and reads register / memory state
  through typed accessors.
- **No third-party script CDN at runtime** other than the Monaco
  loader on `cdn.jsdelivr.net`. Google Fonts are self-hosted via
  `next/font/google` so no font CDN connection happens at runtime.
- **No SharedArrayBuffer**, so we don't need COEP and the strict cross-
  origin isolation it requires. The WASM emulator copies bytes
  through worker `postMessage` instead.
- **No analytics, no third-party trackers**, no telemetry.

## What you can do safely

- Open any `?bundle=<lz>` or `#p2=<lz>` URL a classmate sends. The
  worst case is "the playground refuses to load the payload".
- Upload any `.s` / `.asm` / `.txt` file. Source bigger than the cap
  is refused with a toast; the editor keeps its previous contents.
- Drop any bookmark JSON. Malformed entries are filtered out and
  reported in the toast.

## What you should still be careful about

- The C-to-asm view forwards your C source to the Compiler Explorer
  API (`https://godbolt.org`). See [`docs/c-to-asm.md`](c-to-asm.md)
  for the full privacy / caching note. Don't paste secrets into that
  pane.
- localStorage is per-browser-per-origin and unencrypted. If you save
  a bookmark with stdin that contains a password, anyone with access
  to that profile can read it.

## Reporting

Found something that looks wrong? Open an issue with the smallest
reproducer you can. If it's a real exploit (anything that lets a URL
execute code outside the WASM sandbox or read another origin's
state), email instead of opening a public issue.
