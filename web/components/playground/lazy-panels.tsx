"use client";

import dynamic from "next/dynamic";

/**
 * The playground's heavy and full-chrome-only panels, loaded lazily so a page
 * of embeds (and the embed and checker chrome, which render none of them)
 * never ships their code. Module scope, because a dynamic() call per render
 * hands React a new component type and remounts the panel.
 */

export const InstructionView = dynamic(
  () => import("@/components/panels/InstructionView").then((m) => m.InstructionView),
  { ssr: false },
);
export const MemoryPanel = dynamic(
  () => import("@/components/panels/MemoryPanel").then((m) => m.MemoryPanel),
  { ssr: false },
);
export const StackPanel = dynamic(
  () => import("@/components/panels/StackPanel").then((m) => m.StackPanel),
  { ssr: false },
);
export const WatchPanel = dynamic(
  () => import("@/components/panels/WatchPanel").then((m) => m.WatchPanel),
  { ssr: false },
);
export const MemoryWatches = dynamic(
  () => import("@/components/panels/MemoryWatches").then((m) => m.MemoryWatches),
  { ssr: false },
);
export const BaseConverter = dynamic(
  () => import("@/components/panels/BaseConverter").then((m) => m.BaseConverter),
  { ssr: false },
);
export const ReplayScrubber = dynamic(
  () => import("@/components/playground/ReplayScrubber").then((m) => m.ReplayScrubber),
  { ssr: false },
);
export const SavesPanel = dynamic(
  () => import("@/components/panels/SavesPanel").then((m) => m.SavesPanel),
  { ssr: false },
);
export const TerminalPane = dynamic(
  // Named so the bundle budget in package.json can glob xterm's chunk by name;
  // a hashed webpack id moves with any change to the module graph, and a budget
  // pointed at a hashed id measures nothing.
  () =>
    import(/* webpackChunkName: "terminal" */ "@/components/panels/TerminalPane").then(
      (m) => m.TerminalPane,
    ),
  { ssr: false, loading: () => null },
);
export const TutorialRunner = dynamic(
  () => import("@/components/playground/TutorialRunner").then((m) => m.TutorialRunner),
  { ssr: false },
);
export const InterfaceWalkthrough = dynamic(
  () => import("@/components/playground/InterfaceWalkthrough").then((m) => m.InterfaceWalkthrough),
  { ssr: false },
);
