"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { readShareHash, type ShareState } from "@/lib/share";
import { parseDeepLink } from "@/lib/use-deep-link";
import { loadAutoSavedBuffer } from "@/lib/auto-save";
import { useTheme } from "@/lib/use-theme";
import type { Action } from "@/lib/commands";
import type { Shortcut } from "@/components/ShortcutsHelp";
import {
  EmbeddablePlayground,
  type EmbeddableChrome,
  type EmbeddablePlaygroundHandle,
  type EmbeddableState,
} from "@/components/EmbeddablePlayground";

// The three page-level modals mount only when opened. The emulator surface
// itself lives in EmbeddablePlayground, which owns the single hub.
const CommandPalette = dynamic(
  () => import("@/components/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
const ShortcutsHelp = dynamic(
  () => import("@/components/ShortcutsHelp").then((m) => m.ShortcutsHelp),
  { ssr: false },
);
const ShareDialog = dynamic(
  () => import("@/components/ShareDialog").then((m) => m.ShareDialog),
  { ssr: false },
);

const DEFAULT_SOURCE = `// cpsc 355 playground
// write ARM64 assembly, hit Assemble, then Step or Run

    MOV X0, #5       // n = 5
    MOV X1, #1       // result = 1
loop:
    MUL X1, X1, X0   // result *= n
    SUBS X0, X0, #1  // n--
    B.GT loop
    SVC #0            // halt
`;

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

type Boot = {
  source: string;
  args: string;
  stdin?: string;
  cursor?: { line: number; column: number };
  fromShare: boolean;
};

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

// Resolve the starter buffer once on mount. Precedence matches the prior
// playground: a diagnostic bundle deep-link, then a share hash, then the
// autosaved buffer, then the cold-load default. Theme / embed / example are
// applied after mount (they are not needed to seed the editor buffer).
function initialBoot(): Boot {
  if (typeof window === "undefined") {
    return { source: DEFAULT_SOURCE, args: "", fromShare: false };
  }
  const dl = parseDeepLink(window.location.search);
  if (dl.bundle) {
    return {
      source: dl.bundle.source,
      args: dl.bundle.args ?? "",
      stdin: dl.bundle.stdin,
      fromShare: false,
    };
  }
  const fromHash = readShareHash(window.location.hash);
  if (fromHash) {
    return {
      source: fromHash.source,
      args: fromHash.args ?? "",
      stdin: fromHash.stdin,
      cursor: fromHash.cursor,
      fromShare: true,
    };
  }
  const saved = loadAutoSavedBuffer();
  const source = saved && saved.length > 0 ? saved : DEFAULT_SOURCE;
  return { source, args: "", fromShare: false };
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

  // Deep-link bootstrap (post-mount): embed chrome, a pinned theme, and the
  // async example fetch driven through the ref. Deferring these keeps the
  // first client render matching the server (no hydration mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dl = parseDeepLink(window.location.search);
    if (dl.theme) setTheme(dl.theme);
    if (dl.example && !dl.bundle) {
      const exampleStem = dl.example;
      const tryLoad = async (ext: "asm" | "s") => {
        const res = await fetch(`/examples/cpsc355/${exampleStem}.${ext}`);
        if (!res.ok) return false;
        const text = await res.text();
        playgroundRef.current?.loadSource(text, exampleStem);
        return true;
      };
      void (async () => {
        if (!(await tryLoad("asm"))) await tryLoad("s");
      })();
    }
  }, [setTheme]);

  // Global shortcuts. Execution keys delegate to the component through the
  // ref; palette / help toggle page state. F5 / Shift+F5 / F10 also fire
  // inside Controls -- this preserves the prior page-level bindings exactly.
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
