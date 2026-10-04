# Where each feature lives

An index from a feature to the files that implement it, for when you want to
change one thing without reading the whole tree. Paths are from the
repository root.

## Site pages

| Feature | Files |
| --- | --- |
| Home page (`/`) | `web/app/(site)/page.tsx`, `web/components/landing/Hero.tsx`, `FeatureCatalog.tsx`, `web/lib/content/landing-content.ts` |
| Home page program, drawn as static text so `/` loads no editor | `web/components/playground/StaticCodeView.tsx` |
| Home page demo that steps on its own, with pause and replay | `web/components/landing/HeroDemo.tsx` |
| Menu, footer, and page list | `web/lib/content/site.ts`, `web/components/chrome/SiteNav.tsx`, `SiteFooter.tsx`, `MobileNavDrawer.tsx` |
| GitHub star count in the menu (read once per build, hidden when it cannot be read) | `web/lib/content/github.ts`, `web/components/chrome/StarCount.tsx`, `.github/workflows/refresh-stars.yml` |
| Skip-to-content link | `web/app/layout.tsx`, `.skip-link` in `web/app/globals.css` |
| 404 and error pages, with a report to copy | `web/app/not-found.tsx`, `web/components/chrome/NotFound.tsx`, `web/app/error.tsx`, `web/app/global-error.tsx` |
| Lessons (`/learn`) | `web/app/(site)/learn/`, `web/components/learn/`, `web/lib/content/lessons.ts`, `lesson-schema.ts` |
| A lesson's practice links and its previous and next buttons | `web/components/learn/LessonNav.tsx` |
| Exercises (`/practice`), coding on one side and theory sets on the other | `web/app/(site)/practice/`, `web/components/practice/ExerciseIndex.tsx`, `ExerciseView.tsx`, `web/lib/content/exercises.ts`, `exercise-schema.ts`, `practice-topics.ts` |
| Quizzes, fill-in-the-blank sets, and prediction sets | `web/components/practice/InteractiveExerciseView.tsx`, `QuizBlock.tsx`, `BlanksBlock.tsx`, `PredictionBlock.tsx`, `FeedbackAlert.tsx`, `web/lib/content/theory-answers.ts` |
| Exercise checker (runs the program on the visible and hidden cases; no stored answer) | `web/lib/content/exercise-checker.ts` |
| Saved answers, solved marks, and the progress file | `web/lib/playground/exercise-answers.ts`, `solved-state.ts` |
| Reference (`/reference`) | `web/app/(site)/reference/`, `web/components/reference/`, `web/lib/content/reference-data.ts`, `pitfall-data.ts`, `pitfalls/` (one file of pitfall cards per group) |
| Instruction finder on the reference: the course's instructions first, a search that matches the mnemonic, the description, and the C and forgives small typos, group buttons, the closest rows when nothing matches, and the search kept in the address (`?q=`, `group=`, `show=all`) | `web/components/reference/InstructionReference.tsx`, `web/lib/content/instruction-finder.ts` |
| Which instructions the course uses, read at build time from the lessons, examples, exercise solutions, and pitfalls | `web/lib/content/course-instructions.ts` |
| The C equivalent of each instruction | `web/lib/asm/c-equivalents.ts` |
| Teaching diagrams (flag panel, condition codes, encodings, frame walk, stack alignment, register files) | `web/components/diagrams/` |
| Flag math behind the diagrams | `web/lib/emulator/flag-math.ts` |
| Search on the lesson and practice pages and the pitfalls tab, and the word match under the instruction finder (every word typed must start a word in the text) | `web/lib/content/search-words.ts` |
| Code listing with a copy button, and the "open in playground" button | `web/components/ui/CodeBlock.tsx`, `OpenInPlayground.tsx` |
| Page titles, snippets, structured data, and the sitemap | `web/lib/content/seo.ts`, `web/app/sitemap.ts`, `web/app/robots.ts` |
| Share card image | `web/public/og.png`, `SHARE_CARD_IMAGE` in `web/lib/content/site.ts` |
| Site summary for language models (`/llms.txt`) | `web/public/llms.txt` |

## The playground

| Feature | Files |
| --- | --- |
| The one emulator component used on every page | `web/components/playground/EmbeddablePlayground.tsx`, `EmbeddableCore.tsx` (owns the emulator hook), `use-embeddable-state.ts` |
| The full debugger's panels and dialogs, loaded only on `/playground` | `web/components/playground/FullChromeSurface.tsx`, `lazy-full-chrome.tsx`, `use-workspace-import.ts`, `use-full-chrome-run.ts`, `use-active-file.ts`, `use-debug-panes.tsx` |
| Lesson and exercise editors (run, step, back, reset, check) | `web/components/playground/EmbedLayout.tsx` |
| Editor (Monaco), loaded on demand | `web/components/playground/Editor.tsx`, `monaco-setup.ts`, `lazy-editor.tsx` |
| Editor on touch screens | `web/components/playground/TouchEditor.tsx` |
| Completion, hover cards, and error explanations | `web/lib/asm/asm-completion.ts`, `instruction-docs.ts`, `error-explain.ts` |
| The list of mnemonics behind the reference, hover cards, and highlighting | `web/lib/asm/mnemonics.ts`, `highlight-arm64.ts` |
| Source formatter (`Ctrl+Shift+F`) | `web/lib/asm/asm-formatter.ts` |
| Assemble, run, step, back, and reset | `web/components/playground/Controls.tsx`, `web/lib/emulator/use-emulator.ts` |
| Breakpoints | `web/components/playground/Editor.tsx`, `web/lib/emulator/use-breakpoints.ts` |
| Step back (the last 128 instructions) | `emulator/src/snapshot.rs` |
| Replay slider | `web/components/playground/ReplayScrubber.tsx`, `web/lib/emulator/replay.ts` |
| Save states and bookmarks | `web/components/panels/SavesPanel.tsx`, `web/lib/playground/named-saves.ts`, `web/lib/hooks/use-named-saves.ts` |
| Diagnostic bundle (a report and a link to reopen the run) | `web/components/playground/DiagnosticBundle.tsx`, `web/lib/playground/diagnostic-bundle.ts`, `bundle-markdown.ts` |
| Stepping through a library call (names the call, keeps the `bl` line marked) | `host_call_context` in `emulator/src/lib.rs`, `web/components/panels/DecodeStrip.tsx` |
| Note when a program reads a register a library call overwrote | `clobber_caller_saved` in `emulator/src/registers.rs`, `web/lib/emulator/clobber-note.ts` |
| Interface walkthrough (`?walkthrough`) | `web/components/playground/InterfaceWalkthrough.tsx`, `web/lib/playground/walkthrough.ts` |
| Tutorials | `web/components/playground/TutorialRunner.tsx`, `web/lib/content/tutorials.ts` |
| Command palette (`Ctrl+K`) and keyboard shortcut help (`?`) | `web/components/playground/CommandPalette.tsx`, `ShortcutsHelp.tsx`, `web/lib/playground/palette-commands.ts`, `web/app/playground/page.tsx` |
| Example menu | `web/components/playground/ExampleLoader.tsx`, `web/public/examples/cpsc355/` |
| Loading a program from a link, an example, or the last session | `web/lib/playground/playground-handoff.ts`, `web/lib/hooks/use-deep-link.ts` |
| Console or terminal choice for the interactive examples (`?run=`) | `web/components/playground/RunModeControl.tsx`, `web/lib/playground/playground-handoff.ts` |
| Recent programs | `web/components/playground/RecentPrograms.tsx`, `web/lib/playground/auto-save.ts` |

## Panels

| Feature | Files |
| --- | --- |
| Registers: `x`, `d`, and `v` views, decimal or hex, vector lanes | `web/components/panels/RegisterPanel.tsx`, `RegisterRow.tsx`, `DRegisterRow.tsx`, `VRegisterRow.tsx`, `register-view-state.ts`, `register-panel-settings.ts`, `reveal-rows.ts`, `web/lib/emulator/vector-lanes.ts` |
| Encoding strip for the current instruction | `web/components/panels/DecodeStrip.tsx`, `web/lib/emulator/decode-fields.ts`, `web/lib/asm/explain-line.ts` |
| Disassembly | `web/components/panels/InstructionView.tsx` |
| Memory, with labels from the emulator's address map | `web/components/panels/MemoryPanel.tsx`, `web/lib/emulator/memory-map.ts` |
| Stack and frame labels | `web/components/panels/StackPanel.tsx`, `web/lib/emulator/frame-labels.ts` |
| Console, with input for `scanf` and `read` | `web/components/panels/ConsolePanel.tsx` |
| Terminal | `web/components/panels/TerminalPane.tsx`, `web/lib/terminal/` ([terminal.md](terminal.md)) |
| Watch expressions | `web/components/panels/WatchPanel.tsx`, `web/lib/emulator/watch-expr.ts` |
| Memory watches | `web/components/panels/MemoryWatches.tsx` |
| Number converter (binary, octal, decimal, hex, IEEE-754) | `web/components/panels/BaseConverter.tsx`, `web/lib/asm/base-convert.ts`, `ieee754.ts` |
| Files that persist between visits (IndexedDB) | `web/lib/playground/vfs-persist.ts` |

## Files, sharing, and import

| Feature | Files |
| --- | --- |
| More than one source file | `web/components/playground/MultiFileTabs.tsx`, `web/lib/playground/file-map.ts` |
| Share links (`#p2=`) | `web/lib/playground/share.ts`, `web/components/playground/ShareDialog.tsx` |
| Import and export (`.asm`, `.s`, workspace `.json`) | `web/components/playground/ImportExport.tsx`, `web/lib/playground/workspace-bundle.ts` |
| Command-line arguments | `web/components/playground/ArgsInput.tsx`, `web/lib/playground/args.ts` |
| Upload size limits | `web/lib/playground/upload-guard.ts` |

## Layout

| Feature | Files |
| --- | --- |
| Resizable panels on a wide screen | `web/components/playground/ResizableLayout.tsx`, `web/lib/hooks/use-layout-persistence.ts` |
| Phone layout, the menu sheet, and the run status line | `web/components/playground/PhoneLayout.tsx`, `MoreSheet.tsx`, `RunStatus.tsx` |
| Ten themes (dark, light, high contrast, midnight, ember, forest, dusk, paper, glacier, rose) and the theme picker | `web/lib/theme/themes.ts`, `web/lib/theme/tokens.ts`, `web/lib/hooks/use-theme.ts`, `web/components/chrome/ThemeControl.tsx` |
| Zoom a panel (`Ctrl+Wheel`) | `web/lib/hooks/use-zoom.ts`, `web/components/ui/ZoomControl.tsx` |

## Offline and install

| Feature | Files |
| --- | --- |
| Web app manifest | `web/app/manifest.ts` |
| Service worker and its build-time file list | `web/lib/playground/sw.js`, `scripts/write-precache-list.js`, `web/lib/playground/register-sw.ts`, `web/components/chrome/RegisterSW.tsx` |
| Save every page for offline | `web/components/chrome/SaveOffline.tsx`, `web/lib/playground/offline-status.ts` |
| The page an unsaved address shows offline | `web/app/(site)/offline/page.tsx` |
| Offline badge and the iPhone install tip | `web/components/chrome/OfflineBadge.tsx`, `InstallHint.tsx` |

## The emulator

| Feature | Files |
| --- | --- |
| m4, lexer, parser, sections, and linker | `emulator/src/frontend/` |
| Encoder: the mnemonic list and dispatch, then one file per instruction class | `emulator/src/assembler.rs`, `emulator/src/assembler/` |
| Decoder and the encoding tables, one file per instruction class | `emulator/src/decoder.rs`, `emulator/src/decoder/` |
| What each instruction does, in the decoder's classes | `emulator/src/executor.rs`, `emulator/src/executor/`, `fpu.rs` |
| Registers, memory, and the run loop | `emulator/src/registers.rs`, `memory.rs`, `cpu.rs`, `emulator/src/cpu/` |
| Library calls and system calls | `emulator/src/hosted/` |
| The functions the site calls | `emulator/src/lib.rs` |
| The web side of the emulator (backend, worker) | `web/lib/emulator/backend.ts`, `web/lib/worker/` |
| Response headers | `web/next.config.mjs`, `vercel.json` |
