# Feature reference

A per-feature index of where each capability lives in the source, for
when you want "where does X live?" without reading the whole tree. It
covers the playground and the study-site pages (landing, learn, practice,
reference).

## Site & content pages

| Feature | Lives in |
| --- | --- |
| Landing page (`/`) | `web/app/(site)/page.tsx` |
| Hero, feature catalog, credibility, routes | `web/components/Hero.tsx`, `FeatureCatalog.tsx`, `CredibilitySection.tsx`, `RoutesRegisterFile.tsx` |
| Landing data (features, routes, hero program) | `web/lib/landing-content.ts` |
| Routes, nav, footer | `web/lib/site.ts`, `web/components/SiteNav.tsx`, `SiteFooter.tsx` |
| Shared embeddable emulator | `web/components/EmbeddablePlayground.tsx` |
| Lessons (`/learn`) | `web/app/(site)/learn/`, `web/components/LessonIndex.tsx`, `LessonArticle.tsx`, `LessonMarkdown.tsx`, `web/lib/lessons.ts` |
| Exercises (`/practice`) | `web/app/(site)/practice/`, `web/components/ExerciseIndex.tsx`, `ExerciseView.tsx`, `web/lib/exercises.ts` |
| Exercise checker (no stored solution) | `web/lib/exercise-checker.ts` |
| Reference (`/reference`) | `web/app/(site)/reference/`, `web/components/ReferenceView.tsx`, `InstructionReference.tsx`, `InstructionView.tsx`, `PitfallsCatalog.tsx`, `CallingConventionGuide.tsx`, `web/lib/reference-data.ts` |
| Content schemas + author JSON | `web/lib/lesson-schema.ts`, `exercise-schema.ts`, `web/content/` |

## Editor & assembly

| Feature | Lives in |
| --- | --- |
| Monaco editor with three themes | `web/components/Editor.tsx` |
| Mobile fallback editor (textarea) | `web/components/Editor.tsx::FallbackEditor` |
| Source formatter (`Ctrl+Shift+F`) | `web/lib/asm-formatter.ts` |
| Context-aware completion provider | `web/lib/asm-completion.ts` |
| Per-mnemonic Monaco hover docs | `web/lib/instruction-docs.ts`, `error-explain.ts` |
| CPSC 355 mode lint rules | `web/lib/cpsc355-lint.ts`, `use-cpsc355-mode.ts` |
| Multi-file tabs (concat at assemble) | `web/components/MultiFileTabs.tsx` |
| Glyph-margin breakpoint dots | `web/components/Editor.tsx` |

## Run loop & debugging

| Feature | Lives in |
| --- | --- |
| Assemble / step / run / pause | `web/components/Controls.tsx`, `web/lib/use-emulator.ts` |
| 128-frame step-back | `emulator/src/snapshot.rs::SnapshotRing` |
| Replay scrubber (visual seek) | `web/components/ReplayScrubber.tsx`, `web/lib/replay.ts` |
| Named save states (session-scoped) | `web/lib/use-emulator.ts`, `web/components/SavesPanel.tsx` |
| Persistent bookmarks (across reloads) | `web/lib/named-saves.ts`, `use-named-saves.ts` |
| Diagnostic bundle (clipboard + URL) | `web/components/DiagnosticBundle.tsx`, `web/lib/diagnostic-bundle.ts` |
| Hotspot mode (instruction heat map) | `web/lib/use-hotspot-mode.ts` |

## Panels & state

| Feature | Lives in |
| --- | --- |
| Register panel with ABI aliases | `web/components/RegisterPanel.tsx`, `RegisterRow.tsx` |
| Memory panel (sparse, paged) | `web/components/MemoryPanel.tsx` |
| Stack panel + frame-pointer chase | `web/components/StackPanel.tsx`, `web/lib/frame-labels.ts` |
| Watch expressions (`x0`, `*x0`, `[fp, name]`, `arr[i]`) | `web/components/WatchPanel.tsx`, `web/lib/watch-expr.ts` |
| Memory address watches | `web/components/MemoryWatches.tsx` |
| Console (stdout/stderr + stdin) | `web/components/ConsolePanel.tsx` |
| Current-instruction strip | `web/components/CurrentStrip.tsx`, `web/lib/explain-line.ts` |

## Layout & responsive

| Feature | Lives in |
| --- | --- |
| Resizable nested panels (lg+) | `web/components/ResizableLayout.tsx` |
| Bottom tab strip (< md) | `web/components/MobileLayout.tsx` |
| Mobile nav drawer (< md) | `web/components/MobileNavDrawer.tsx` |
| Layout persistence | `web/lib/use-layout-persistence.ts` |
| Three-way theme cycle | `web/lib/use-theme.ts`, `web/components/ThemeControl.tsx` |
| Lecture mode (HC + fullscreen) | `web/lib/use-lecture-mode.ts`, `web/components/LectureBar.tsx` |
| Per-panel zoom (`Ctrl+Wheel`) | `web/lib/use-zoom.ts`, `web/components/ZoomControl.tsx` |
| Breakpoint hook | `web/lib/use-breakpoint.ts` |

## Input & deep-link

| Feature | Lives in |
| --- | --- |
| Args bar (argv at entry) | `web/components/ArgsInput.tsx`, `web/lib/args.ts` |
| Share link (`#p2=<lz>`) | `web/lib/share.ts`, `web/components/ShareDialog.tsx` |
| Deep-link query parsing | `web/lib/use-deep-link.ts` |
| `?bundle=<lz>` restore | `web/lib/diagnostic-bundle.ts` |
| `?embed=1` chrome-stripped mode | `web/app/playground/page.tsx` (uses `useDeepLink`) |
| Import / export source | `web/components/ImportExport.tsx` |
| Import target router | `web/lib/use-import-target.ts` |

## Terminal pane

| Feature | Lives in |
| --- | --- |
| xterm.js wrapper | `web/components/TerminalPane.tsx` |
| Command parser (`./prog`, `gdb`) | `web/lib/terminal/dispatch.ts` |
| Input + history + tab-completion | `web/lib/terminal/input-state.ts` |

## Tutorials & examples

| Feature | Lives in |
| --- | --- |
| Tutorial runner with `expect` checks | `web/components/TutorialRunner.tsx`, `web/lib/tutorials.ts` |
| Example loader (stage-grouped) | `web/components/ExampleLoader.tsx` |
| Recent programs | `web/components/RecentPrograms.tsx`, `web/lib/auto-save.ts` |

## PWA & offline

| Feature | Lives in |
| --- | --- |
| Manifest | `web/app/manifest.ts` |
| Service worker (cache-first / network-first split) | `web/public/sw.js` |
| SW registration (idempotent) | `web/lib/register-sw.ts`, `web/components/RegisterSW.tsx` |
| Online / offline badge | `web/components/OfflineBadge.tsx` |

## Notifications

| Feature | Lives in |
| --- | --- |
| Toast queue (react-hot-toast) | `web/components/Toast.tsx` (`<ToastHost>`, `useToast`) |

## Security gates

| Feature | Lives in |
| --- | --- |
| Upload size caps | `web/lib/upload-guard.ts` |
| Bundle / share validators | `web/lib/diagnostic-bundle.ts`, `web/lib/share.ts` |
| Bookmark validator | `web/lib/named-saves.ts::isValidSave` |
| Response headers (CSP, COOP, ...) | `web/middleware.ts`, `vercel.json` |
