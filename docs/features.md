# Feature reference

A per-feature index of where each capability lives in the source, for
when you want "where does X live?" without reading the whole tree. It
covers the playground and the study-site pages (landing, learn, practice,
reference).

## Site & content pages

| Feature | Lives in |
| --- | --- |
| Landing page (`/`) | `web/app/(site)/page.tsx` |
| Hero, feature catalog, routes | `web/components/landing/Hero.tsx`, `FeatureCatalog.tsx`, `web/components/diagrams/RoutesRegisterFile.tsx` |
| Landing data (features, routes, hero program) | `web/lib/content/landing-content.ts` |
| Routes, nav, footer | `web/lib/content/site.ts`, `web/components/chrome/SiteNav.tsx`, `SiteFooter.tsx` |
| Shared embeddable emulator | `web/components/playground/EmbeddablePlayground.tsx` |
| Lessons (`/learn`) | `web/app/(site)/learn/`, `web/components/learn/LessonIndex.tsx`, `LessonArticle.tsx`, `LessonMarkdown.tsx`, `web/lib/content/lessons.ts` |
| Exercises (`/practice`) | `web/app/(site)/practice/`, `web/components/practice/ExerciseIndex.tsx`, `ExerciseView.tsx`, `web/lib/content/exercises.ts` |
| Read-only code listing with one-click copy | `web/components/ui/CodeBlock.tsx` |
| "Open in playground" hand-off (shared pill; asm code blocks only) | `web/components/ui/OpenInPlayground.tsx` (used by `web/components/learn/LessonArticle.tsx` and `web/components/practice/ExerciseView.tsx`) |
| Exercise checker (no stored solution) | `web/lib/content/exercise-checker.ts` |
| Reference (`/reference`) | `web/app/(site)/reference/`, `web/components/reference/ReferenceView.tsx`, `InstructionReference.tsx`, `InstructionView.tsx`, `PitfallsCatalog.tsx`, `CallingConventionGuide.tsx`, `web/lib/content/reference-data.ts` |
| Reference interactivity (NZCV panel, condition-code explorer, worked encodings, frame walk, alignment probe, runnable pitfalls) | `web/components/diagrams/FlagEffect.tsx`, `CondCodeExplorer.tsx`, `BitFieldDiagram.tsx`, `FrameWalk.tsx`, `StackAlignment.tsx`, `web/components/reference/PitfallsCatalog.tsx` |
| Register-file teaching diagrams (x/w and d/s views) | `web/components/diagrams/RegisterFileDiagram.tsx`, `FpRegisterFileDiagram.tsx` |
| AAPCS64 register-file rail (with the fp convention) | `web/components/diagrams/AapcsRail.tsx` |
| Link preview card (og/twitter image) | `web/lib/content/site.ts::SHARE_CARD_IMAGE`, `web/public/og.png`, per-route metadata under `web/app/` |
| Content schemas + author JSON | `web/lib/content/lesson-schema.ts`, `exercise-schema.ts`, `web/content/` |

## Editor & assembly

| Feature | Lives in |
| --- | --- |
| Monaco editor with three themes | `web/components/playground/Editor.tsx` |
| Mobile fallback editor (textarea) | `web/components/playground/Editor.tsx::FallbackEditor` |
| Source formatter (`Ctrl+Shift+F`) | `web/lib/asm/asm-formatter.ts` |
| Context-aware completion provider | `web/lib/asm/asm-completion.ts` |
| Per-mnemonic Monaco hover docs | `web/lib/asm/instruction-docs.ts`, `error-explain.ts` |
| Multi-file tabs (concat at assemble) | `web/components/playground/MultiFileTabs.tsx` |
| Glyph-margin breakpoint dots | `web/components/playground/Editor.tsx` |

## Run loop & debugging

| Feature | Lives in |
| --- | --- |
| Assemble / step / run / pause | `web/components/playground/Controls.tsx`, `web/lib/emulator/use-emulator.ts` |
| Pre-assemble gating + cold-load state | `web/components/playground/Controls.tsx`, `FirstRunState.tsx` |
| 128-frame step-back | `emulator/src/snapshot.rs::SnapshotRing` |
| Replay scrubber (visual seek) | `web/components/playground/ReplayScrubber.tsx`, `web/lib/emulator/replay.ts` |
| Named save states (session-scoped) | `web/lib/emulator/use-emulator.ts`, `web/components/panels/SavesPanel.tsx` |
| Persistent bookmarks (across reloads) | `web/lib/playground/named-saves.ts`, `web/lib/hooks/use-named-saves.ts` |
| Diagnostic bundle (clipboard + URL) | `web/components/playground/DiagnosticBundle.tsx`, `web/lib/playground/diagnostic-bundle.ts` |

## Panels & state

| Feature | Lives in |
| --- | --- |
| Register panel with ABI aliases | `web/components/panels/RegisterPanel.tsx`, `RegisterRow.tsx` |
| Floating-point register view (`d0`–`d31`, dec/hex, s-written values read as floats) | `web/components/panels/RegisterPanel.tsx`, `DRegisterRow.tsx` |
| Memory panel (sparse, paged) | `web/components/panels/MemoryPanel.tsx` |
| Stack panel + frame-pointer chase | `web/components/panels/StackPanel.tsx`, `web/lib/emulator/frame-labels.ts` |
| Watch expressions (`x0`, `*x0`, `[fp, name]`, `arr[i]`) | `web/components/panels/WatchPanel.tsx`, `web/lib/emulator/watch-expr.ts` |
| Memory address watches | `web/components/panels/MemoryWatches.tsx` |
| Console (stdout/stderr + stdin) | `web/components/panels/ConsolePanel.tsx` |
| Interactive stdin (blocked read pulls the console forward, gates run/step/back) | `web/components/panels/ConsolePanel.tsx`, `web/components/playground/Controls.tsx`, `EmbeddablePlayground.tsx` |
| Persistent VFS home directory (IndexedDB, full playground only) | `web/lib/playground/vfs-persist.ts`, `web/components/playground/EmbeddablePlayground.tsx` |
| Register auto-follow (fp write flips to the d file) | `web/components/panels/RegisterPanel.tsx` |
| Base converter (convert tab) | `web/components/panels/BaseConverter.tsx`, `web/lib/asm/base-convert.ts` |
| Live decode strip (bit fields under the pc) | `web/components/panels/DecodeStrip.tsx`, `web/lib/emulator/decode-fields.ts`, `web/lib/asm/explain-line.ts` |

## Layout & responsive

| Feature | Lives in |
| --- | --- |
| Resizable nested panels (lg+) | `web/components/playground/ResizableLayout.tsx` |
| Bottom tab strip (< md) | `web/components/playground/MobileLayout.tsx` |
| Mobile nav drawer (< md) | `web/components/chrome/MobileNavDrawer.tsx` |
| Layout persistence | `web/lib/hooks/use-layout-persistence.ts` |
| Three-way theme cycle | `web/lib/hooks/use-theme.ts`, `web/components/chrome/ThemeControl.tsx` |
| Token-driven select (collapsed listbox) | `web/components/ui/Select.tsx` |
| Per-panel zoom (`Ctrl+Wheel`) | `web/lib/hooks/use-zoom.ts`, `web/components/ui/ZoomControl.tsx` |
| Breakpoint hook | `web/lib/hooks/use-breakpoint.ts` |
| Command palette (`Ctrl+K`) | `web/components/playground/CommandPalette.tsx` |
| Keyboard shortcuts help (`?`) | `web/components/playground/ShortcutsHelp.tsx` |

## Input & deep-link

| Feature | Lives in |
| --- | --- |
| Args bar (argv at entry) | `web/components/playground/ArgsInput.tsx`, `web/lib/playground/args.ts` |
| Share link (`#p2=<lz>`) | `web/lib/playground/share.ts`, `web/components/playground/ShareDialog.tsx` |
| Deep-link query parsing | `web/lib/hooks/use-deep-link.ts` |
| Program handoff (boot precedence, example fetch) | `web/lib/playground/playground-handoff.ts` |
| `?bundle=<lz>` restore | `web/lib/playground/diagnostic-bundle.ts` |
| `?embed=1` chrome-stripped mode | `web/app/playground/page.tsx` (uses `parseDeepLink`) |
| Import / export source | `web/components/playground/ImportExport.tsx` |
| Import target router | `web/lib/hooks/use-import-target.ts` |

## Terminal pane

| Feature | Lives in |
| --- | --- |
| xterm.js wrapper | `web/components/panels/TerminalPane.tsx` |
| Command parser (`./prog`, VFS commands, `gdb` subset) | `web/lib/terminal/dispatch.ts` |
| Course toolchain (`m4 f.asm > f.s`, `gcc f.s -o prog`, `./prog`) | `web/lib/terminal/dispatch.ts`, the wasm `m4_expand` export, the hub's `assembleForTool` in `web/lib/emulator/use-emulator.ts` |
| Input + history + tab-completion | `web/lib/terminal/input-state.ts` |

## Multi-file workspaces

| Feature | Lives in |
| --- | --- |
| Files strip (main.asm + helper tabs, persisted) | `web/components/playground/MultiFileTabs.tsx` |
| Combined-line <-> owning-file mapping (errors, marker, breakpoints, jump-to-error) | `web/lib/playground/file-map.ts`, wired in `web/components/playground/EmbeddablePlayground.tsx` |
| Share links carrying the whole workspace | `web/lib/playground/share.ts` |
| Multi-select import (main + helpers in one pick) | `web/components/playground/ImportExport.tsx` |
| Multi-file example payloads (`EXAMPLE_FILES`) | `web/lib/playground/playground-handoff.ts` |
| No-entry-point link gate (`main` or `_start` required) | `emulator/src/frontend/pipeline.rs` |

## Tutorials & examples

| Feature | Lives in |
| --- | --- |
| Tutorial runner with `expect` checks | `web/components/playground/TutorialRunner.tsx`, `web/lib/content/tutorials.ts` |
| Example loader (stage-grouped) | `web/components/playground/ExampleLoader.tsx` |
| Terminal-first examples (snake, the data structures visualizer) | `EXAMPLE_TERMINAL` in `web/lib/playground/playground-handoff.ts`, the terminal takeover in `web/components/playground/EmbeddablePlayground.tsx` |
| Recent programs | `web/components/playground/RecentPrograms.tsx`, `web/lib/playground/auto-save.ts` |

## PWA & offline

| Feature | Lives in |
| --- | --- |
| Manifest | `web/app/manifest.ts` |
| Service worker (cache-first / network-first split) | `web/public/sw.js` |
| SW registration (idempotent) | `web/lib/playground/register-sw.ts`, `web/components/chrome/RegisterSW.tsx` |
| Online / offline badge | `web/components/chrome/OfflineBadge.tsx` |

## Notifications

| Feature | Lives in |
| --- | --- |
| Toast queue (react-hot-toast) | `web/components/ui/Toast.tsx` (`<ToastHost>`, `useToast`) |

## Security gates

| Feature | Lives in |
| --- | --- |
| Upload size caps | `web/lib/playground/upload-guard.ts` |
| Bundle / share validators | `web/lib/playground/diagnostic-bundle.ts`, `web/lib/playground/share.ts` |
| Bookmark validator | `web/lib/playground/named-saves.ts::isValidSave` |
| Response headers (CSP, COOP, ...) | `web/proxy.ts`, `vercel.json` |
