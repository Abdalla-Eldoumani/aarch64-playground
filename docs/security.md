# Security

The site runs entirely in the browser. It has no API routes, no server
actions, and no database: every page is a static file built ahead of time,
and nothing a visitor types, uploads, or runs leaves the tab. The one outbound
call the build makes reads the repository's public star count from GitHub; it
carries no visitor data.

What the site still has to defend is its input. The playground accepts
programs and data from URLs (share links, diagnostic links, query
parameters) and from files (source files, files for the virtual filesystem,
bookmark JSON), and it runs programs written by anyone.

## What an attacker can and cannot do

1. An attacker cannot store anything on the site. The only saved data lives in
   the visitor's own browser: localStorage keys starting with
   `aarch64-playground:`, and the playground's files in the
   `aarch64-playground` IndexedDB database.
2. An attacker can send a link or a file. Opening it must not crash the tab,
   hang it, or run anything but the emulated program.

## Response headers

The `headers()` function in `web/next.config.mjs` sets these on every route
except `/_next/static`, `/_next/image`, `/sw.js`, `/manifest.webmanifest`, and
`/icons/`, so they apply under `npm run dev`, `npm run start`, and on Vercel.
`vercel.json` repeats the same set for the deployed site, and
`web/next.config.test.ts` fails if the two copies differ.

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, full policy in `web/next.config.mjs` | Every resource comes from the site itself, apart from Vercel's analytics script (`va.vercel-scripts.com`) and its beacon (`vitals.vercel-insights.com`). `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS only, for two years, subdomains included |
| `X-Content-Type-Options` | `nosniff` | The browser never guesses a file's type and runs it as a script |
| `X-Frame-Options` | `DENY` | No other site can frame the playground |
| `Cross-Origin-Opener-Policy` | `same-origin` | A window the site opens cannot script it |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other sites see only the origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Turns off sensors the site never uses |

Three parts of the script policy need a reason:

- `'wasm-unsafe-eval'` lets the page start the WebAssembly emulator.
- `'unsafe-eval'` appears only under `npm run dev`, where Next.js's hot reload
  evaluates modules with `eval`. `web/next.config.mjs` adds it only when
  `NODE_ENV` is `development`, and `vercel.json` never has it.
- `'unsafe-inline'` (scripts and styles) is there because Next.js writes
  inline startup scripts and styles without a nonce, and the editor injects
  style tags while it runs. Script injection is covered instead by the input
  checks below and by never inserting unsanitized HTML.

## Input checks

Every value from a URL or a file goes through a typed check before any of it
reaches React, the editor, or the emulator.

| Input | Checked by | Refuses |
| --- | --- | --- |
| `?bundle=` diagnostic link | `web/lib/playground/diagnostic-bundle.ts` (`decodeBundle`) | a version other than 1 or 2, a field of the wrong type, more than 1 MiB once decompressed |
| `#p2=` share link | `web/lib/playground/share.ts` (`readShareHash`) | a field of the wrong type, more than 12 KiB compressed or 1 MiB decompressed |
| `?example=` | `web/lib/hooks/use-deep-link.ts`, regex `/^[\w.-]+$/` | paths and special characters |
| `?theme=` and `?run=` | the same file, a fixed list of values | any other value |
| `?embed=` | the same file | anything but exactly `1` |
| Bookmark JSON import | `web/lib/playground/named-saves.ts` (`isValidSave`) | a field of the wrong type; a name already in use is skipped, not overwritten |
| `.s`, `.asm`, or `.txt` upload | `web/lib/playground/upload-guard.ts` | files over 1 MiB |
| Virtual filesystem upload | `web/lib/playground/upload-guard.ts` | files over 4 MiB |
| Bookmark JSON upload | `web/lib/playground/upload-guard.ts` | files over 1 MiB |

## Limits in the emulator

A program can never hang the tab or use up its memory, however it arrived.
The limits live in the Rust code, and each one stops the program, or refuses
the call, with a plain message instead of a crash:

- At most 10,000,000 instructions (`cpu::MAX_TOTAL_STEPS`), counted until the
  next assemble or reset.
- At most 8192 mapped 4 KiB pages, 32 MiB (`memory::MAX_MAPPED_PAGES`): enough
  to fill the 8 MiB stack and the 16 MiB heap together.
- At most 4 MiB of output (`cpu::MAX_OUTPUT_BYTES`), and a cap on the field
  width and precision `printf` will pad to.
- In the virtual filesystem: 4 MiB per file, 4 MiB in total, and 16 files. A
  call past a limit returns -1, as a full disk does on Linux.
- A load or store in the first page, or a memory access through `sp` or a
  library call while `sp` is not a multiple of 16, stops the program, as a
  segmentation fault or bus error would on the course server.

`emulator/tests/bounds.rs` and the unit tests for the library calls test each
limit.

## Other rules the code follows

- Lesson and exercise Markdown renders through `react-markdown` with
  `rehype-sanitize`. No component inserts unsanitized HTML.
- The editor only receives text through its own APIs. The diagnostic report is
  copied to the clipboard, never inserted into the page.
- Nothing evaluates JavaScript built from input. The watch expressions are
  parsed by hand and read the machine through typed functions.
- The editor (Monaco) and the fonts are served from the site itself, so no
  outside script host is trusted at run time.
- The site does not use `SharedArrayBuffer`, so it needs no cross-origin
  isolation headers. The worker copies bytes through `postMessage`.
- Vercel's firewall sits in front of the site. Clients that are not browsers
  get a JavaScript challenge; known search engines and link previews pass.
- Vercel Analytics and Speed Insights set no cookies and run only on the
  production site.

## What you can safely open

- Any share link or diagnostic link a classmate sends. At worst the playground
  refuses to load it.
- Any `.s`, `.asm`, or `.txt` file. A file over the limit is refused and the
  editor keeps what it had.
- Any bookmark JSON. Broken entries are skipped, and the message says how many.

localStorage is stored unencrypted in your browser profile. A bookmark whose
input holds a password can be read by anyone who can use that profile.

## Dependencies

`web/package.json` pins every direct dependency to an exact version. CI fails
on any shipped dependency with an advisory of moderate severity or higher. Run
the same check, or the stricter one that includes development tools, from the
repository root:

```bash
node scripts/audit-deps.js --omit=dev
node scripts/audit-deps.js
```

`overrides` in `web/package.json` holds `dompurify`, which arrives through
monaco-editor, and `postcss` at patched versions. monaco-editor also bundles
its own copy of DOMPurify, which `overrides` cannot reach. That copy only
cleans the editor's own widgets, and the site never passes the editor
untrusted HTML, so a hostile document cannot reach it. It is checked again at
every monaco-editor update.

## Check the headers

`scripts/check-headers.js` requests a page and checks every header above. Run
it against a local production server (`npm run build`, then `npm run start` in
`web/`):

```bash
node scripts/check-headers.js http://localhost:3000
```

Run with no argument, it checks <https://aarch64-playground.com>. The firewall
answers scripts there with a challenge, so that check needs the maintainer's
bypass value in the `PROBE_TOKEN` environment variable.

## Reporting a problem

Open an issue with the smallest program or link that shows it. If it is a real
exploit, such as a link that runs code outside the emulator or reads another
site's data, report it privately through
[GitHub's advisory form](https://github.com/Abdalla-Eldoumani/aarch64-playground/security/advisories/new)
instead. The same contact is in `/.well-known/security.txt` on the site.
