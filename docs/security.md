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
   `aarch64-playground:`, the playground's files in the `aarch64-playground`
   IndexedDB database, and the service worker's Cache Storage. Its one cache
   per build, `aarch64-playground-<build id>`, holds the site's own pages and
   files for offline use.
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
| `#bundle=` diagnostic link, and `?bundle=` in links made before the bundle moved to the fragment | `web/lib/playground/diagnostic-bundle.ts` (`decodeBundle`) | a version other than 1 or 2, a field of the wrong type, more than 1 MiB once decompressed |
| `#p2=` share link | `web/lib/playground/share.ts` (`readShareHash`) | a source that is not text or does not match its checksum, a file name the **+** tab would refuse, more than 16 KiB compressed or 1 MiB decompressed. Any other field of the wrong type, or a files list of the wrong shape or over 16 files, is dropped, and the program still opens |
| Checks in a `#p2=` link | `web/lib/playground/program-checks.ts` (`parseChecks`) | more than 32 checks, a name over 100 characters, args over 1000 characters, stdin or expected output over 100 KiB, an exit code that is not a whole number from 0 to 255, a field of the wrong type. One bad check drops the whole list, and the program still opens |
| `?example=` | `web/lib/hooks/use-deep-link.ts`, regex `/^[\w.-]+$/` | paths and special characters |
| `?theme=` and `?run=` | the same file, a fixed list of values | any other value |
| `?embed=` | the same file | anything but exactly `1` |
| Bookmark JSON import | `web/lib/playground/named-saves.ts` (`isValidSave`) | a field of the wrong type; a name already in use is skipped, not overwritten |
| `.s`, `.asm`, or `.txt` upload | `web/lib/playground/upload-guard.ts` | files over 1 MiB |
| Virtual filesystem upload | `web/lib/playground/upload-guard.ts` | files over 4 MiB |
| Bookmark JSON upload | `web/lib/playground/upload-guard.ts` | files over 1 MiB |

Stdin typed into the console or terminal, redirected with `<`, or given by an
example, a lesson, an exercise or a share link's checks is held to 100 KiB
(`web/lib/playground/upload-guard.ts`). Two paths are not: a check typed into
the playground's **checks** tab, whose stdin over the cap gets a note and is
kept out of share links but is read whole by the run, and a bookmark imported
from a file, whose stdin is held only by the file's 1 MiB cap. Both are the
student's own input, run in their own tab.

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
- A program that sleeps (`nanosleep`, `usleep`) earns back one instruction per
  microsecond slept and one byte of output per ten, never past the two limits
  above, up to 200,000,000 instructions and 4 MiB in a run. The terminal pane
  waits out every sleep in real time, so there the caps are what four hours of
  sleeping earns, 14,400,000,000 instructions and 1,440,000,000 bytes
  (`cpu::REAL_TIME_REFUND_STEPS`, `cpu::REAL_TIME_REFUND_OUTPUT_BYTES`), and a
  sleep counts against them only what it gave back. That bounds a terminal
  session's work, not its length: a game using most of each second's refill
  runs about five to eight hours, and a program that does little each second
  can run for weeks. A program that never sleeps meets the limits above.
- In the virtual filesystem: 4 MiB per file, 4 MiB in total, and 16 files. A
  call past a limit fails as on a full Linux disk: a system call returns a
  negative error number, a library call -1 or NULL.
- A load or store in the first page, a store into the program's own code, a
  library call's store into the host stub window just under 4 GiB, or a memory
  access through `sp` or a library call while `sp` is not a multiple of 16,
  stops the program, as a segmentation fault or bus error would on the course
  server.
- While assembling: m4 stops at the line where the text its rounds have
  built, counting every round of every line, passes 32 MiB
  (`frontend::m4::MAX_EXPANSION_WORK_BYTES`). In GNU m4's order the same
  budget counts the text each macro call builds plus 1 KiB for the call, and
  m4 also stops once calls nest more than 32 deep inside one another's
  arguments or 1,024 expansions are begun and not yet read to their end
  (`frontend::m4_gnu`). A section holds at most 1 MiB
  (`layout::SECTION_WINDOW`), and filled `.space` and `.skip` lines that would
  take one past it are refused at the line that does, before their bytes are
  built.

The stack view caps its own records, so a deep recursion cannot use up memory
through them either. It records at most 16,384 calls
(`frames::MAX_ACTIVATIONS`); deeper calls are counted, not stored. The call
tree keeps at most 200 entries: a call that finds them full drops the oldest
finished calls and counts them, and calls nested past 12 levels are counted,
not stored. The view draws at most 64
frames. Past 64, the frames between main and the newest 63 fold into one line
that counts them. None of the three caps stops the program.

Three more caps keep the tab answering, and none of them stops the program
either:

- The check that runs when a program loads keeps at most 1,000 macro warnings
  and 256 KiB of their text (`frontend::lint::MAX_HYGIENE_WARNINGS` and
  `MAX_HYGIENE_BYTES`), and one closing line counts the rest.
- A run hands control back to the page once its library calls have done
  16 MiB of work, the bytes they walk, read or format and the free-list
  entries they scan (`cpu::MAX_HOST_WORK_PER_RUN`), so Pause and Reset land
  between calls. Apart from the bytes `memcmp` and `strncmp` compare, the
  instruction limit does not count this work.
- Step back's memory logs over 64 KiB, kept for steps such as a `memset` over
  a large buffer, share 32 MiB (`cpu::MAX_SNAPSHOT_LOG_BYTES`).
  Past it the oldest frames go, so step back reaches fewer steps behind such
  calls.

`emulator/tests/bounds.rs`, `emulator/tests/step_back_memory.rs`, and the unit
tests beside each limit's code test them.

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
- The terminal pane caps the count a program prints in seven control
  sequences (scroll up and down, insert and delete lines, tab forward and
  back, and repeat the last character) at what the screen shows: its rows, its
  columns, or rows times columns (`COUNT_LIMITS` in
  `web/components/panels/TerminalPane.tsx`). A count within the screen
  behaves as before.
- Vercel's firewall sits in front of the deployed site. Its rules live in the
  Vercel project's settings, not in this repository. With the current rules,
  clients that are not browsers get a JavaScript challenge, and known search
  engines and link previews pass.
- Vercel Analytics and Speed Insights set no cookies. `web/app/layout.tsx`
  adds both to every page of every build, so they load on preview
  deployments as well as production. A local server has no analytics
  scripts to serve, so there they only log errors, as the README says.

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

`overrides` in `web/package.json` holds three packages at patched versions:
`dompurify`, which arrives through monaco-editor, `postcss`, which arrives
through Next.js, and `minimatch`, for the copy
`@typescript-eslint/typescript-estree` uses in the lint tools. ESLint and its
plugins keep minimatch 3, whose API differs, so that override applies
to that one package. The root `package.json` holds the same `postcss`
override for the copy of Next.js that Vercel installs there, from the root
`package-lock.json` with `npm ci`. Dependabot watches the root and `web/`.

monaco-editor also bundles its own, older copy of DOMPurify, a file inside
its package that `overrides` cannot change. The editor uses it to clean the
Markdown it shows, such as its hover cards, and the labels of its buttons.
None of that holds HTML from a link or a file, so the old copy was hard to
reach. It still had known flaws, so the build swaps it out.
`web/next.config.mjs` tells webpack to load the installed `dompurify` package
wherever the editor asks for its own copy, so the editor runs the patched
version. `npm run size` then reads the version each copy of DOMPurify in the
built JavaScript states and fails if any is older than the one in
`overrides`. A later monaco-editor update cannot bring the old copy back
without that check failing.

The production build, `scripts/vercel-build.sh`, downloads the Rust
toolchain, wasm-pack, the wasm-bindgen CLI and `wasm-opt`. Each is pinned to
an exact version and a sha256 written in the script, and the build stops
before it runs any file whose hash differs. The emulator builds with cargo's
`--locked`, so its crates are the ones `emulator/Cargo.lock` names, each
checked against the hash recorded there.

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
