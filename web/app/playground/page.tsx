"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { ShareState } from "@/lib/playground/share";
import { parseDeepLink } from "@/lib/hooks/use-deep-link";
import {
  fetchExample,
  loadBundleDecoder,
  resolveBoot,
  resolveHandoff,
  type HandoffPayload,
  type LaunchMode,
  type PlaygroundBoot,
} from "@/lib/playground/playground-handoff";
import { loadAutoSavedBuffer } from "@/lib/playground/auto-save";
import { useTheme } from "@/lib/hooks/use-theme";
import type { Action } from "@/lib/playground/commands";
import type { Shortcut } from "@/components/playground/ShortcutsHelp";
import {
  EmbeddablePlayground,
  type EmbeddableChrome,
  type EmbeddablePlaygroundHandle,
  type EmbeddableState,
} from "@/components/playground/EmbeddablePlayground";
import { SiteNav } from "@/components/chrome/SiteNav";
import { useStarCount } from "@/components/chrome/StarCount";
// The cold-load default program is the arithmetic basics example. Import its
// single source -- the same file the example loader serves and the corpus
// verifier checks against fixtures -- so the default can never drift from it.
import DEFAULT_SOURCE from "@/public/examples/cpsc355/basics.s?raw";

// The three page-level modals mount only when opened. The emulator surface
// itself lives in EmbeddablePlayground, which owns the single hub.
const CommandPalette = dynamic(
  () => import("@/components/playground/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
const ShortcutsHelp = dynamic(
  () => import("@/components/playground/ShortcutsHelp").then((m) => m.ShortcutsHelp),
  { ssr: false },
);
const ShareDialog = dynamic(
  () => import("@/components/playground/ShareDialog").then((m) => m.ShareDialog),
  { ssr: false },
);

const SHORTCUTS: Shortcut[] = [
  { keys: "F6", description: "assemble (Ctrl+Enter does the same)" },
  { keys: "F10", description: "step" },
  { keys: "Shift+F10", description: "step back (up to 128 instructions)" },
  { keys: "F5", description: "run / pause" },
  { keys: "Shift+F5", description: "reset" },
  { keys: "Ctrl+K", description: "open command palette" },
  { keys: "Ctrl+Shift+F", description: "format the source" },
  { keys: "Ctrl+S", description: "nothing to save: the buffer is written continuously" },
  { keys: "Ctrl+/", description: "toggle line comment" },
  { keys: "Shift+Alt+A", description: "toggle block comment" },
  { keys: "Ctrl+Wheel", description: "zoom the panel under the pointer" },
  { keys: "?", description: "show this help" },
];

// `?embed=1` is a client-only URL flag. Reading it through
// useSyncExternalStore keeps the first hydration render matching the server
// (chrome="full") and switches to embed afterwards without a mismatch -- and
// without a setState-in-effect.
function subscribeEmbedParam(): () => void {
  return () => {};
}
function readEmbedParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

/**
 * Apply a `?run=` override to an example payload. Absent leaves the
 * example's own default in place, which is the regression contract for
 * every `?example=` link ever shared. The override rides only the example
 * branch: a share or bundle payload is not an example delivery, and a
 * `?run=` with no `?example=` has no program to own.
 */
function withRun(payload: HandoffPayload, run: LaunchMode | undefined): HandoffPayload {
  return run ? { ...payload, launch: run } : payload;
}

// Resolve the starter buffer once on mount. Precedence: a diagnostic
// bundle deep-link, then a share hash, then the autosaved buffer, then
// the cold-load default. This runs during render, so on a client-side
// navigation it can only see the PREVIOUS route's URL; the post-mount
// effect below re-reads the committed URL and delivers whatever this
// pass missed. Theme / embed / example are always applied after mount.
function initialBoot(): PlaygroundBoot {
  if (typeof window === "undefined") {
    return {
      source: DEFAULT_SOURCE,
      args: "",
      fromShare: false,
      fromBundle: false,
    };
  }
  return resolveBoot(
    window.location.search,
    window.location.hash,
    loadAutoSavedBuffer(),
    DEFAULT_SOURCE,
  );
}

export default function Home() {
  const playgroundRef = useRef<EmbeddablePlaygroundHandle>(null);
  const [boot] = useState(initialBoot);
  const isEmbed = useSyncExternalStore(
    subscribeEmbedParam,
    readEmbedParam,
    () => false,
  );
  const chrome: EmbeddableChrome = isEmbed ? "embed" : "full";
  // The route's server layout looked the count up and put it here; null keeps
  // the icon-only link this bar has always rendered.
  const stars = useStarCount();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteActions, setPaletteActions] = useState<Action[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareState, setShareState] = useState<ShareState>({ source: "" });
  const [, toggleTheme, setTheme] = useTheme();
  // The outcome slice mirrors the hub for the F5 run/pause decision and the
  // future outcome checker; the page never holds the hub itself.
  const outcomeRef = useRef<EmbeddableState | null>(null);

  const onStateChange = useCallback((state: EmbeddableState) => {
    outcomeRef.current = state;
  }, []);

  const openCommandPalette = useCallback(() => {
    setPaletteActions(playgroundRef.current?.getCommands() ?? []);
    setPaletteOpen(true);
  }, []);
  const openShortcutsHelp = useCallback(() => setHelpOpen(true), []);
  const openShareDialog = useCallback(() => {
    const files = playgroundRef.current?.getFiles() ?? [];
    setShareState({
      source: playgroundRef.current?.getSource() ?? "",
      files: files.length > 0 ? files : undefined,
      args: playgroundRef.current?.getArgs() || undefined,
      cursor: playgroundRef.current?.getCursor(),
    });
    setShareOpen(true);
  }, []);

  // Deep-link bootstrap (post-mount): a pinned theme, plus whatever
  // program payload the render-time boot could not deliver. Effects run
  // after the router commits the URL, so this pass sees the REAL
  // destination even on a client-side navigation, where initialBoot read
  // the previous route and fell back to the autosave. Examples are always
  // delivered here (they need a fetch), with their args, stdin, and VFS
  // fixtures riding along; a failed or oversize fetch keeps the booted
  // buffer.
  // The delivery URL this pass already handled. `boot` is captured once, so
  // without it a second pass over a NEW hash would ask resolveHandoff about
  // a payload the FIRST one consumed and be told there is nothing to do.
  const deliveredUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dl = parseDeepLink(window.location.search);
    if (dl.theme) setTheme(dl.theme);
    // Boot failures surface through the playground component's toast
    // binding (see EmbeddablePlaygroundHandle.notifyError): the page
    // entry's own react-hot-toast is a separate module instance in the
    // production chunk graph and its dispatches never reach the mounted
    // Toaster. Deferred a beat so the handle is registered even if this
    // effect wins the mount race.
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const toastSoon = (message: string) => {
      // 1.5s: past the first paint, so the notice lands when the student
      // is already looking at a settled page rather than racing the boot.
      timers.push(setTimeout(() => playgroundRef.current?.notifyError(message), 1500));
    };
    // A share link that failed to decode fell back to the autosave; say
    // so; the only signal used to be the absence of the share banner.
    if (boot.shareError) {
      toastSoon(
        boot.shareError === "too-large"
          ? "that share link is too large to load, so your own buffer is still here"
          : "that share link is damaged, usually a partial copy. your own buffer is still here; ask the sender for the link again",
      );
    }
    // A bundle failure is reported by the delivery pass below, not here: the
    // boot render has no decoder, so it can no longer carry one.
    // The bundle decoder is fetched only for a URL that carries one, so the
    // delivery runs a beat behind this effect. That is also why the boot pass
    // no longer decodes: a hard `?bundle=` load arrives here instead.
    // Pinned before the await: the URL can change under a deferred pass, and
    // this one must deliver the URL it was started for or the change handler
    // below delivers the new one a second time.
    const bootSearch = window.location.search;
    const bootHash = window.location.hash;
    void (async () => {
      const decode = await loadBundleDecoder(bootSearch);
      const handoff = resolveHandoff(boot, bootSearch, bootHash, decode);
      if (handoff?.kind === "share-error") {
        toastSoon(
          handoff.reason === "too-large"
            ? "that share link is too large to load"
            : "that share link is damaged, usually a partial copy. ask the sender for the link again",
        );
      } else if (handoff?.kind === "bundle-error") {
        toastSoon(
          handoff.reason === "too-large"
            ? "that diagnostic-bundle link is too large to load, so your own buffer is still here"
            : "that diagnostic-bundle link is damaged, usually a partial copy. your own buffer is still here; ask the sender for the link again",
        );
      } else if (handoff?.kind === "example") {
        // fetchExample's failures are already student-readable ("invalid
        // example name", "failed to load example: 404"); swallowing them
        // shipped the wrong buffer to a whole class off one typo'd link.
        void fetchExample(handoff.stem)
          .then((payload) => playgroundRef.current?.loadProgram(withRun(payload, dl.run)))
          .catch((e: unknown) => {
            toastSoon(e instanceof Error ? e.message : "could not load that example");
          });
      } else if (handoff) {
        playgroundRef.current?.loadProgram(handoff.payload);
      }
    })();
    deliveredUrlRef.current = window.location.search + window.location.hash;

    // A URL that changes without remounting this page (the back button, or a
    // second share link pasted into the address bar of an open tab) never
    // re-ran the pass above, so nothing arrived. Re-deliver from the new URL,
    // telling resolveHandoff that this one has consumed nothing yet.
    const onUrlChange = () => {
      const url = window.location.search + window.location.hash;
      if (url === deliveredUrlRef.current) return;
      deliveredUrlRef.current = url;
      const search = window.location.search;
      const hash = window.location.hash;
      void (async () => {
        const decode = await loadBundleDecoder(search);
        const next = resolveHandoff(
          { fromShare: false, fromBundle: false },
          search,
          hash,
          decode,
        );
        if (next?.kind === "share-error" || next?.kind === "bundle-error") {
          toastSoon(
            next.reason === "too-large"
              ? "that link is too large to load"
              : "that link is damaged, usually a partial copy. ask the sender for it again",
          );
        } else if (next?.kind === "example") {
          // The run override rides the URL, so this pass re-reads it from
          // the URL it is delivering, not from the mount-time parse.
          const run = parseDeepLink(search).run;
          void fetchExample(next.stem)
            .then((payload) => playgroundRef.current?.loadProgram(withRun(payload, run)))
            .catch((e: unknown) => {
              toastSoon(e instanceof Error ? e.message : "could not load that example");
            });
        } else if (next) {
          playgroundRef.current?.loadProgram(next.payload);
        }
      })();
    };
    window.addEventListener("hashchange", onUrlChange);
    window.addEventListener("popstate", onUrlChange);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("hashchange", onUrlChange);
      window.removeEventListener("popstate", onUrlChange);
    };
  }, [setTheme, boot]);

  // Global shortcuts, single owner. Every execution key delegates to the
  // component through the imperative handle; palette / help toggle page state.
  // Controls renders the same actions as visible buttons but no longer binds
  // keys, so a keypress fires exactly once -- and embed chrome, which omits
  // Controls, still gets the shortcuts from here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteActions(playgroundRef.current?.getCommands() ?? []);
        setPaletteOpen((v) => !v);
      } else if (meta && e.key.toLowerCase() === "s") {
        // The buffer autosaves continuously; intercept Ctrl+S so it does not
        // open the browser's save-page dialog. The help entry documents this.
        e.preventDefault();
      } else if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (meta && e.key === "Enter") {
        e.preventDefault();
        playgroundRef.current?.assemble();
      } else if (e.key === "F6") {
        e.preventDefault();
        playgroundRef.current?.assemble();
      } else if (e.key === "F10" && e.shiftKey) {
        e.preventDefault();
        playgroundRef.current?.stepBack();
      } else if (e.key === "F10") {
        e.preventDefault();
        playgroundRef.current?.step();
      } else if (e.key === "F5" && !e.shiftKey) {
        e.preventDefault();
        if (outcomeRef.current?.isRunning) playgroundRef.current?.pause();
        else playgroundRef.current?.run();
      } else if (e.key === "F5" && e.shiftKey) {
        e.preventDefault();
        playgroundRef.current?.reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="flex flex-col h-dvh">
        {!isEmbed && <SiteNav variant="slim" stars={stars} />}
        {/* This route's single main landmark and the root skip link's target.
            The emulator component itself is a labeled section, so every page
            that composes it (hero, lessons, exercises, reference) keeps one
            main -- its own -- and this route still has one of its own. */}
        <main id="main" tabIndex={-1} className="flex-1 min-h-0 flex flex-col">
          <EmbeddablePlayground
            ref={playgroundRef}
            chrome={chrome}
            startSource={boot.source}
            startFiles={boot.fromShare ? boot.files ?? [] : undefined}
            startArgs={boot.args}
            startStdin={boot.stdin}
            startCursor={boot.cursor}
            fromShare={boot.fromShare}
            onStateChange={onStateChange}
            onOpenCommandPalette={openCommandPalette}
            onOpenShortcutsHelp={openShortcutsHelp}
            onOpenShareDialog={openShareDialog}
            onToggleTheme={toggleTheme}
          />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
      <ShortcutsHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={SHORTCUTS}
      />
      <ShareDialog
        open={shareOpen}
        state={shareState}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}
