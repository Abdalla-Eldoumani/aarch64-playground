# Security posture

This is a fully client-side application: every byte of the emulator runs in
your tab. We still take a defensive stance because the playground accepts
URL-borne input (share hashes, diagnostic-bundle deep links, query params) and
file uploads (source files, VFS payloads, bookmark JSON), all untrusted. There
is no server surface: no API routes, no backend, nothing to persist or
exfiltrate beyond the browser.

## Threat model in two sentences

1. An attacker cannot persist state. There is no server-side data store; the
   only data kept is per-browser localStorage under the `aarch64-playground:*`
   key prefix.
2. An attacker can craft a URL or file the user opens. The playground must not
   crash, hang, or run unintended code in response to any deep-link payload or
   file upload.

## What's enforced

### HTTP response headers

The security headers are defined in both `vercel.json` (deploy-time) and
`web/middleware.ts` (framework-level, so they also hold under `next start` and
dev), kept in lockstep.

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, full policy in source | Restricts every resource type to `'self'` plus a small allowlist; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`. Third-party origins: `cdn.jsdelivr.net` (Monaco), `va.vercel-scripts.com` (Analytics + Speed Insights script), `vitals.vercel-insights.com` (its beacon) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS (two-year max-age, subdomains, preload) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniff-driven script execution |
| `X-Frame-Options` | `DENY` | Blocks framing (clickjacking) |
| `Cross-Origin-Opener-Policy` | `same-origin` | Windows we open cannot script us |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Disables sensors we never request and opts out of FLoC |

Static assets and the WASM module are served `immutable`; `/sw.js` is
`must-revalidate` so updates land immediately. These cache headers are
per-route in `vercel.json`.

### Input validation gates

Every URL-borne or file-borne payload runs through a typed validator before any
of its fields touch React state, the editor, or the WASM emulator.

| Surface | Validator | What it rejects |
| --- | --- | --- |
| `?bundle=<lz>` deep link | `lib/diagnostic-bundle.ts::decodeBundle` | non-version-1 payloads, malformed field types, > 1 MB inflated |
| `#p2=<lz>` share hash | `lib/share.ts::readShareHash` | non-string source, malformed cursor, > 1 MB inflated |
| `?example=<id>` | regex `/^[\w.-]+$/` | path traversal, special chars |
| `?theme=<name>` | enum check | unknown values |
| Bookmark JSON import | `lib/named-saves.ts::isValidSave` | per-field type check, no-clobber on name collision |
| `.s` / `.asm` / `.txt` upload | `lib/upload-guard.ts` + `MAX_SOURCE_BYTES` | files > 1 MB |
| VFS upload (console + terminal) | `lib/upload-guard.ts` + `MAX_VFS_BYTES` | files > 10 MB |
| Bookmark JSON upload | `lib/upload-guard.ts` + `MAX_BOOKMARK_JSON_BYTES` | files > 1 MB |

### Emulator bounds

User assembly runs untrusted, so the emulator can never hang or exhaust the
tab. The walls live in the Rust core and hold however the program arrived
(typed, shared, or uploaded):

- Step ceiling `cpu::MAX_TOTAL_STEPS` = 10,000,000, counted across every step
  and the run loop. A runaway loop trips it and stops.
- Mapped-page cap `memory::MAX_MAPPED_PAGES` = 1024 (4 MiB live). A store past
  the cap faults, and the step converts that fault to a halt.
- Host-runtime caps so one libc or syscall call cannot allocate without bound
  from a guest-supplied size: `write` reads into a growable buffer instead of
  pre-reserving its count, `printf` clamps field width and precision
  (`MAX_FIELD_WIDTH`), and a virtual-filesystem file cannot grow past
  `syscalls::MAX_VFS_FILE_BYTES` (16 MiB) through `lseek` then `write`.

Every limit is a calm halt or a refused call carrying a plain-language result,
never a panic or a silent stop. Proven by `emulator/tests/bounds.rs` and the
hosted-runtime unit tests.

### Practices we follow

- Author-supplied Markdown (lessons, exercises) renders through
  `react-markdown` + `remark-gfm` + `rehype-sanitize`. No
  `dangerouslySetInnerHTML` with unsanitized content exists anywhere.
- Everything Monaco shows goes through its typed APIs. The diagnostic-bundle
  markdown is written to the clipboard, never injected into the DOM.
- No dynamic JS evaluation. The watch-expression evaluator parses by hand into
  a small AST and reads register and memory state through typed accessors.
- No third-party script CDN at runtime except the Monaco editor loader on
  `cdn.jsdelivr.net`. This is the one third-party script-trust boundary; it is
  constrained to that host in the CSP and protected in transit by HTTPS and
  HSTS. Self-hosting Monaco would remove it and is the natural next hardening
  step. Google Fonts are self-hosted via `next/font/google`, so no font CDN
  connection happens at runtime.
- No SharedArrayBuffer, so we need no COEP and the strict cross-origin
  isolation it requires. The worker copies bytes through `postMessage`.
- Vercel Analytics and Speed Insights are anonymized, set no cookies, and run
  only on the production deploy. Their script and beacon endpoints are the only
  third-party origins the page reaches.

## What you can do safely

- Open any `?bundle=<lz>` or `#p2=<lz>` URL a classmate sends. Worst case: the
  playground refuses to load the payload.
- Upload any `.s` / `.asm` / `.txt` file. Source over the cap is refused with a
  toast and the editor keeps its previous contents.
- Drop any bookmark JSON. Malformed entries are filtered out and reported in
  the toast.

## What you should still be careful about

- localStorage is per-browser-per-origin and unencrypted. A bookmark whose
  stdin holds a password is readable by anyone with access to that profile.

## Dependency posture

Direct dependencies are pinned to exact versions. `npm audit` against `web/`
reports zero vulnerabilities, and two transitive packages are held to patched
lines through `overrides` in `package.json` (`postcss` and `dompurify`) to keep
known XSS fixes in place.

Run `node scripts/audit-deps.js` from the repo root any time; it exits non-zero
on any moderate-or-higher advisory, stricter than CI needs but quieter than
`npm audit`'s "any" threshold. `node scripts/check-headers.js` GETs the
deployed origin and asserts every header above is present; run it after any
deploy or `vercel.json` change.

## Reporting

Found something that looks wrong? Open an issue with the smallest reproducer
you can. If it is a real exploit (anything that lets a URL execute code outside
the WASM sandbox or read another origin's state), email instead of opening a
public issue.
