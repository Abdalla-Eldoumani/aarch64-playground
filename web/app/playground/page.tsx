"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { ShareState } from "@/lib/playground/share";
import { parseDeepLink } from "@/lib/hooks/use-deep-link";
import {
  fetchExample,
  resolveBoot,
  resolveHandoff,
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
  { keys: "F6", description: "assemble" },
  { keys: "F10", description: "step" },
  { keys: "Shift+F10", description: "step back (up to 128 frames)" },
  { keys: "F5", description: "run / pause" },
  { keys: "Shift+F5", description: "reset" },
  { keys: "Ctrl+K", description: "open command palette" },
  { keys: "Ctrl+S", description: "auto-save (also runs every 500ms)" },
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
    setShareState({
      source: playgroundRef.current?.getSource() ?? "",
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
    // so -- the only signal used to be the ABSENCE of the share banner.
    if (boot.shareError) {
      toastSoon(
        boot.shareError === "too-large"
          ? "that share link is too large to load -- showing your own buffer instead"
          : "that share link is damaged (often a partial copy) -- showing your own buffer instead; ask for the link again",
      );
    }
    const handoff = resolveHandoff(boot, window.location.search, window.location.hash);
    if (handoff?.kind === "share-error") {
      toastSoon(
        handoff.reason === "too-large"
          ? "that share link is too large to load"
          : "that share link is damaged (often a partial copy) -- ask for the link again",
      );
    } else if (handoff?.kind === "example") {
      // fetchExample's failures are already student-readable ("invalid
      // example name", "failed to load example: 404"); swallowing them
      // shipped the wrong buffer to a whole class off one typo'd link.
      void fetchExample(handoff.stem)
        .then((payload) => playgroundRef.current?.loadProgram(payload))
        .catch((e: unknown) => {
          toastSoon(e instanceof Error ? e.message : "could not load that example");
        });
    } else if (handoff) {
      playgroundRef.current?.loadProgram(handoff.payload);
    }
    return () => timers.forEach(clearTimeout);
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
      } else if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
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
        {!isEmbed && <SiteNav variant="slim" />}
        <EmbeddablePlayground
          ref={playgroundRef}
          chrome={chrome}
          startSource={boot.source}
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
