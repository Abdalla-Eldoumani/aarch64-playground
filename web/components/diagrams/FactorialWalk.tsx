"use client";

/**
 * fact(4) stepped one frame at a time with the frame walk. The code is cut
 * from the guide's factorial example, the program that ran on the course
 * server, so the walk and the runnable program are the same lines. Each step
 * names the instruction it stops at, and that names the highlighted line.
 */

import type { JSX } from "react";
import { FrameWalk, type BandProps, type WalkStep } from "@/components/diagrams/FrameWalk";
import { GUIDE_EXAMPLES } from "@/lib/content/calling-convention-examples";

const SOURCE_LINES = GUIDE_EXAMPLES.factorial.source.split("\n");
const FIRST = SOURCE_LINES.indexOf("fact:");
const LAST = SOURCE_LINES.findIndex((line, i) => i > FIRST && line.trim() === "ret");
const FACT_LINES = SOURCE_LINES.slice(FIRST, LAST + 1);

/** The line of fact that starts with this instruction, spaces ignored. */
function lineOf(instruction: string): number {
  const squeeze = (text: string) => text.trim().replace(/\s+/g, " ");
  return FACT_LINES.findIndex((line) => squeeze(line).startsWith(squeeze(instruction)));
}

// main's frame sits at 0xffe0; each fact frame is 32 bytes below the last.
const address = (depth: number) => `0x${(0xffe0 - 0x20 * depth).toString(16)}`;
/** What each fact frame keeps of its caller's x19, deepest call last. */
const SAVED_X19 = ["main's", "4", "3", "2"];

interface FactState {
  /** The instruction the step stops at; it picks the highlighted line. */
  at: string;
  /** Which call is running, shown before the instruction. */
  where: string;
  effect: string;
  /** How many fact frames are open. */
  depth: number;
  x0: string;
  x19: string;
  changed: ("sp" | "fp" | "x0" | "x19")[];
}

const STATES: FactState[] = [
  {
    at: "fact:",
    where: "main",
    effect: "main put 4 in x0 and called fact. Only main's frame is on the stack; fact has not opened one yet.",
    depth: 0,
    x0: "4",
    x19: "main's",
    changed: [],
  },
  {
    at: "bl fact",
    where: "fact(4)",
    effect: "fact(4) opened a 32-byte frame, saved main's x19 in it, and keeps its own n = 4 in x19. Now it calls fact(3) with 3 in x0.",
    depth: 1,
    x0: "3",
    x19: "4",
    changed: ["sp", "fp", "x0", "x19"],
  },
  {
    at: "bl fact",
    where: "fact(3)",
    effect: "fact(3) does the same one frame lower: it saves the 4 in x19 before putting its own n = 3 there.",
    depth: 2,
    x0: "2",
    x19: "3",
    changed: ["sp", "fp", "x0", "x19"],
  },
  {
    at: "bl fact",
    where: "fact(2)",
    effect: "fact(2) saves the 3, keeps n = 2 in x19, and calls fact(1).",
    depth: 3,
    x0: "1",
    x19: "2",
    changed: ["sp", "fp", "x0", "x19"],
  },
  {
    at: "b.le fact_done",
    where: "fact(1)",
    effect: "n = 1 ends the recursion: x0 already holds 1, so fact(1) skips the call. This is the deepest point, one frame for each call still waiting for an answer.",
    depth: 4,
    x0: "1",
    x19: "1",
    changed: ["sp", "fp", "x19"],
  },
  {
    at: "mul x0, x0, n_r",
    where: "fact(2)",
    effect: "fact(1) put x19 = 2 back from its frame and returned, so that frame is free again. fact(2) finds its n in x19 and multiplies: 1 times 2 is 2.",
    depth: 3,
    x0: "2",
    x19: "2",
    changed: ["sp", "fp", "x0", "x19"],
  },
  {
    at: "mul x0, x0, n_r",
    where: "fact(3)",
    effect: "fact(2) restored x19 = 3 and returned. fact(3) multiplies: 2 times 3 is 6.",
    depth: 2,
    x0: "6",
    x19: "3",
    changed: ["sp", "fp", "x0", "x19"],
  },
  {
    at: "mul x0, x0, n_r",
    where: "fact(4)",
    effect: "One more return, and fact(4) multiplies: 6 times 4 is 24.",
    depth: 1,
    x0: "24",
    x19: "4",
    changed: ["sp", "fp", "x0", "x19"],
  },
  {
    at: "ret",
    where: "fact(4)",
    effect: "fact(4) put main's x19 back, closed its frame, and returns 24 in x0. Only main's frame is left, as before the call.",
    depth: 0,
    x0: "24",
    x19: "main's",
    changed: ["sp", "fp", "x19"],
  },
];

function bands(state: FactState, opened: boolean): BandProps[] {
  const top = ["<- sp", "<- fp"];
  return [
    {
      label: "main's frame",
      detail: `at ${address(0)}: main's saved fp and lr`,
      markers: state.depth === 0 ? top : [],
    },
    ...[4, 3, 2, 1].map((n, i) => {
      const depth = i + 1;
      const open = depth <= state.depth;
      return {
        label: `fact(${n})'s frame`,
        detail: open
          ? `at ${address(depth)}: saved fp, lr, and x19 = ${SAVED_X19[i]}`
          : "free: below sp",
        ghost: !open,
        changed: opened && depth === state.depth,
        markers: depth === state.depth ? top : [],
      };
    }),
  ];
}

const FACT_STEPS: WalkStep[] = STATES.map((state, i) => ({
  spell: `${state.where}: ${state.at}`,
  effect: state.effect,
  codeLine: lineOf(state.at),
  registers: [
    { name: "sp", value: address(state.depth), changed: state.changed.includes("sp") },
    { name: "fp", value: address(state.depth), changed: state.changed.includes("fp") },
    { name: "x0", value: state.x0, changed: state.changed.includes("x0") },
    { name: "x19", value: state.x19, changed: state.changed.includes("x19") },
  ],
  // A frame is amber only on the step that opened it.
  bands: bands(state, i > 0 && state.depth > STATES[i - 1].depth),
}));

export function FactorialWalk({ className = "" }: { className?: string }): JSX.Element {
  return (
    <FrameWalk
      className={className}
      label="factorial walk"
      heading="step the recursion"
      program={FACT_LINES.join("\n")}
      steps={FACT_STEPS}
    />
  );
}
