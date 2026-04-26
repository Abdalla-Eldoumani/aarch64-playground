# Feature reference

A per-feature index pointing at the file that owns each one. Useful
when you want to know "where does X live in the source tree?" without
walking the whole project.

## Editor & assembly

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Monaco editor with three themes     | `web/components/Editor.tsx`                             |
| Mobile fallback editor (textarea)   | `web/components/Editor.tsx::FallbackEditor`             |
| Source formatter (`Ctrl+Shift+F`)   | `web/lib/asm-formatter.ts`                              |
| Context-aware completion provider   | `web/lib/asm-completion.ts`                             |
| Per-mnemonic Monaco hover docs      | `web/lib/instruction-docs.ts`, `error-explain.ts`       |
| `cpsc 355 mode` lint rules          | `web/lib/cpsc355-lint.ts`, toggle via `use-cpsc355-mode.ts` |
| Multi-file tabs (concat at assemble)| `web/components/MultiFileTabs.tsx`                      |
| Glyph-margin breakpoint dots        | `web/components/Editor.tsx`                             |

## Run loop & debugging

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Assemble / step / run / pause       | `web/components/Controls.tsx`, `web/lib/use-emulator.ts`|
| 128-frame step-back                 | `emulator/src/cpu.rs::SnapshotRing`                     |
| Replay scrubber (visual seek)       | `web/components/ReplayScrubber.tsx`, `web/lib/replay.ts`|
| Named save states (session-scoped)  | `web/lib/use-emulator.ts`, `web/app/page.tsx`           |
| Persistent bookmarks (across reloads)| `web/lib/named-saves.ts`, `web/lib/use-named-saves.ts` |
| Diagnostic bundle (clipboard + URL) | `web/components/DiagnosticBundle.tsx`, `web/lib/diagnostic-bundle.ts` |
| Hotspot mode (instruction heat map) | `web/lib/use-hotspot-mode.ts`                           |

## Panels & state

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Register panel with ABI aliases     | `web/components/RegisterPanel.tsx`                      |
| Memory panel (sparse, paged)        | `web/components/MemoryPanel.tsx`                        |
| Stack panel + frame-pointer chase   | `web/components/StackPanel.tsx`, `web/lib/frame-labels.ts` |
| Watch expressions (`x0`, `*x0`, `[fp, name]`, `arr[i]`) | `web/components/WatchPanel.tsx`, `web/lib/watch-expr.ts` |
| Memory address watches              | `web/components/MemoryWatches.tsx`                      |
| Console (stdout/stderr + stdin)     | `web/components/ConsolePanel.tsx`                       |
| ExplainStrip (one-line instr desc)  | `web/components/ExplainStrip.tsx`                       |

## Layout & responsive

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Resizable nested panels (lg+)       | `web/components/ResizableLayout.tsx`                    |
| 10-tab bottom strip (< md)          | `web/components/MobileLayout.tsx`                       |
| Header overflow sheet (< md)        | `web/components/HeaderOverflowSheet.tsx`                |
| Three-way theme cycle               | `web/lib/use-theme.ts`                                  |
| Lecture mode (HC + fullscreen)      | `web/lib/use-lecture-mode.ts`, `LectureBar.tsx`         |
| Per-panel zoom (`Ctrl+Wheel`)       | `web/lib/use-zoom.ts`, `web/components/ZoomControl.tsx` |
| Breakpoint hook                     | `web/lib/use-breakpoint.ts`                             |

## Input & deep-link

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Args bar (argv at entry)            | `web/components/ArgsInput.tsx`, `web/lib/args.ts`       |
| Share link (`#p2=<lz>`)             | `web/lib/share.ts`, `web/components/ShareDialog.tsx`    |
| Deep-link query parsing             | `web/lib/use-deep-link.ts`                              |
| `?bundle=<lz>` restore              | `web/lib/diagnostic-bundle.ts`                          |
| `?embed=1` chrome-stripped mode     | `web/app/page.tsx` (uses `useDeepLink`)                 |
| Import / export source              | `web/components/ImportExport.tsx`                       |
| Import target router                | `web/lib/use-import-target.ts`                          |

## Terminal pane

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| xterm.js wrapper                    | `web/components/TerminalPane.tsx`                       |
| Command parser (`./prog`, `gdb`)    | `web/lib/terminal/dispatch.ts`                          |
| Input + history + tab-completion    | `web/lib/terminal/input-state.ts`                       |

## Tutorials & examples

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Tutorial runner with `expect` checks| `web/components/TutorialRunner.tsx`, `web/lib/tutorials.ts` |
| Example loader (grouped by week)    | `web/components/ExampleLoader.tsx`                      |
| Recent programs                     | `web/components/RecentPrograms.tsx`, `web/lib/auto-save.ts` |

## C-to-asm view

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Compiler Explorer proxy             | `web/app/api/c-to-asm/route.ts`                         |
| Shortlink expansion                 | `web/app/api/c-to-asm/shortlink.ts`                     |
| Client (typed wrapper)              | `web/lib/godbolt.ts`                                    |
| DWARF/CFI filter                    | `web/lib/asm-filter.ts`                                 |
| Diff / side-by-side                 | `web/components/DiffView.tsx`, `web/components/CToAsmView.tsx` |

## PWA & offline

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Manifest                            | `web/app/manifest.ts`                                   |
| Service worker (cache-first/network-first split) | `web/public/sw.js`                          |
| SW registration (idempotent)        | `web/lib/register-sw.ts`, `web/components/RegisterSW.tsx`|
| Online / offline badge              | `web/components/OfflineBadge.tsx`                       |

## Notifications

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Toast queue (react-hot-toast)       | `web/components/Toast.tsx` (`<ToastHost>`, `useToast`)  |

## Security gates

| Feature                             | Lives in                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Upload size caps                    | `web/lib/upload-guard.ts`                               |
| Bundle / share validators           | `web/lib/diagnostic-bundle.ts`, `web/lib/share.ts`      |
| Bookmark validator                  | `web/lib/named-saves.ts::isValidSave`                   |
| Response headers (CSP, COOP, ...)   | `vercel.json`                                           |
