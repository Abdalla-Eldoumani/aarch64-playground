"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { readShareHash, type ShareState } from "@/lib/share";
import { parseDeepLink, resolveExampleStem } from "@/lib/use-deep-link";
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

const DEFAULT_SOURCE = `// calc.asm - Demonstrate all arithmetic operations
// Compile: m4 calc.asm > calc.s && gcc calc.s -o calc && ./calc

define(a, x19)
define(b, x20)
define(result, x21)
define(temp, x22)

            .data
add_fmt:    .string  "%d + %d = %d\\n"
sub_fmt:    .string  "%d - %d = %d\\n"
mul_fmt:    .string  "%d * %d = %d\\n"
div_fmt:    .string  "%d / %d = %d\\n"
mod_fmt:    .string  "%d %% %d = %d\\n"

            .text
            .balign 4
            .global main

main:
            stp     x29, x30, [sp, -16]!
            mov     x29, sp

            // Initialize operands
            mov     a, 47
            mov     b, 5

            add     result, a, b            // result = 47 + 5 = 52

            ldr     x0, =add_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            sub     result, a, b            // result = 47 - 5 = 42

            ldr     x0, =sub_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            mul     result, a, b            // result = 47 * 5 = 235

            ldr     x0, =mul_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            udiv    result, a, b            // result = 47 / 5 = 9

            ldr     x0, =div_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            // remainder = a - (a / b) * b
            udiv    result, a, b            // result = 47 / 5 = 9

            mul     temp, result, b         // temp = 9 * 5 = 45

            sub     result, a, temp         // result = 47 - 45 = 2

            ldr     x0, =mod_fmt
            mov     x1, a
            mov     x2, b
            mov     x3, result
            bl      printf

            mov     x0, 0
            ldp     x29, x30, [sp], 16
            ret
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
      // Translate a legacy week-labeled stem to its renamed file, then
      // fetch from the fixed examples prefix. Every example is now `.s`.
      const exampleStem = resolveExampleStem(dl.example);
      void (async () => {
        const res = await fetch(`/examples/cpsc355/${exampleStem}.s`);
        if (!res.ok) return;
        const text = await res.text();
        playgroundRef.current?.loadSource(text, exampleStem);
      })();
    }
  }, [setTheme]);

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
