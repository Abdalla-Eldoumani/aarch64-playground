# C to AArch64 view

The playground has a "C -> asm" pane reachable from the header (or
directly at `/?view=c-to-asm`). It takes a C snippet, runs it through
AArch64 GCC on Compiler Explorer, and shows the generated assembly
next to the source. Hit **load into playground** and the asm lands in
the main editor so you can step through it.

## Where your code goes

When you compile in the C-to-asm pane, your source is sent to
**godbolt.org** (Matt Godbolt's Compiler Explorer service) over HTTPS.
The playground does not store your source on the playground server,
but Compiler Explorer's own privacy policy applies to the request --
see <https://godbolt.org/privacy>. If your snippet is sensitive, do
not paste it here.

The compile is initiated from a Next.js API route at
`/api/c-to-asm`, which forwards the request to
`https://godbolt.org/api/compiler/<id>/compile` and returns the
filtered assembly to the browser. The browser never talks to
godbolt.org directly during a compile; the proxy lets us cache and
filter centrally.

## Compiler and flags

| setting | value |
| ------- | ----- |
| compiler | AArch64 GCC 14.3.0 (Compiler Explorer id `carm64g1430`) |
| target   | `-march=armv8-a` |
| output   | `-S` (assembly) |
| safety strip | `-fno-asynchronous-unwind-tables`, `-fno-stack-protector`, `-fno-PIE`, `-fno-pic` |
| opt level | user-selected `-O0`, `-O1`, `-O2`, `-O3`, `-Os` |

The id is hard-coded in `web/app/api/c-to-asm/route.ts` with a
re-verification date in the comment. If Compiler Explorer ever
retires the id, the route returns a 502 and the user sees an error
banner -- bump the id in the route file. Live list at
<https://godbolt.org/api/compilers/c?fields=id,name> (ARM64 GCC ids
are keyed `carm64g<version>`).

## Caching

Successful compiles are cached in a module-level `Map` keyed on
`sha256(optLevel + flags + source)`. Each entry is held for **60
seconds** with a **64-entry** soft cap (oldest entry drops when full).
A debounced edit auto-recompile mostly hits the cache, so the
Compiler Explorer rate limit isn't a concern in practice.

The cache lives in serverless function memory, so it is per-region
and doesn't survive a cold start. That's intentional: it keeps repeat
compiles cheap without giving the appearance of a long-lived store of
user source.

## Output filtering

Compiler Explorer returns the raw GAS output. The playground filters
it through `web/lib/asm-filter.ts` before showing it (and before
loading into the playground), stripping:

- `.cfi_*` -- DWARF call-frame directives
- `.LFB*` / `.LFE*` / `.LBB*` / `.LBE*` -- function-body labels GCC
  emits for debug info
- `.loc`, `.file` -- source-line metadata
- `.section .note.GNU-stack`, `.ident` -- linker hints

Real instructions, real labels, and `.string` / `.word` data are
kept. The toggle in the toolbar lets you disable the filter to see
what GCC actually emitted.

## Source-line linkage

When Compiler Explorer's response includes a per-asm-line source map,
the API route forwards it to the browser as `sourceMap: (number |
null)[]`. The C-to-asm pane uses it to highlight the matching C line
while the cursor is on an asm line, and shows the C line number in
the toolbar.

## Open in Compiler Explorer

The "open on godbolt" button builds a URL with `source`, `compiler`,
and `flags` query parameters, then opens godbolt.org in a new tab. No
shortener round trip is involved -- the snippet rides on the URL
itself. Long snippets may push the URL past browser limits; in that
case copy the source by hand and paste it into the Compiler Explorer
UI.

## Errors

| symptom | likely cause |
| ------- | ------------ |
| `compile failed` with stderr text | GCC syntax error in your C; the stderr is shown verbatim. |
| `compiler explorer responded 429` | Upstream rate limit. The cache absorbs most of these; wait 60 seconds and retry. |
| `compiler explorer responded 5xx` | Compiler Explorer outage. Use **open on godbolt** to compile in their UI directly. |
| `upstream fetch failed` | Network issue between Vercel and godbolt.org. Retry. |
| `upstream fetch timed out` | The upstream took longer than `C_TO_ASM_TIMEOUT_MS` (30 s). Usually a Compiler Explorer hiccup; retry. |
| `source exceeds <N> byte limit` | Your C source is over `MAX_C_SOURCE_BYTES` (256 KB). Trim it or compile locally. |

## Limits

The proxy caps inbound C source at `MAX_C_SOURCE_BYTES = 256 KB`
(defined in `web/lib/upload-guard.ts`) and times out the upstream
fetch after `C_TO_ASM_TIMEOUT_MS = 30 s`. Both gates exist to keep
the route from being a free byte-relay or a slow-loris vector.

## Quickstart

1. Click **C -> asm** in the header.
2. Pick a snippet from the dropdown (or paste your own C).
3. Hit **compile** (or wait 500 ms for the auto-compile to fire).
4. Hit **load into playground** and you're back at the assembler with the generated code ready to step.
