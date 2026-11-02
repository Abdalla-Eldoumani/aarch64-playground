import { at } from "@/lib/emulator/clobber-note";
import type { StepTarget } from "@/lib/emulator/emulator-state";
import { cardContext, returnCard, type ProgramLines, type ReturnCard } from "@/lib/emulator/frame-cards";
import type { FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { formatSteps } from "@/lib/emulator/format-steps";
import type { RunResultPayload, StateSnapshot } from "@/lib/worker/protocol";

/** Why a goal run stopped; `problem` goes in the error line, as a bug in the
 *  program or a long run's pause does, and a bad return brings its `card`
 *  for the explainer. */
export interface StopWords {
  text: string;
  problem: boolean;
  card?: ReturnCard;
}

/**
 * Why a step over, step out or run to cursor stopped, in the words the
 * controls and the terminal show. The hub imports this on the first such
 * stop, so a page that never steps over never loads it. Null when there is
 * nothing to add: the error line already says why, or a step over moved one
 * instruction. A ret that went to no caller is said with the frames view's
 * own card (frame-cards.ts).
 */
export function stopReason(
  target: StepTarget,
  result: RunResultPayload,
  snap: StateSnapshot,
  layout: FrameLayoutPayload | null,
  lines: ProgramLines,
): StopWords | null {
  const said = (text: string, problem = false): StopWords => ({ text, problem });
  const ctx = cardContext(snap.frames ?? null, layout, lines);
  const innermost = ctx?.snapshot.frames.at(-1);
  const name = innermost
    ? (ctx?.layout?.functions.find((f) => f.entry === innermost.entry)?.name ?? "this function")
    : "this function";
  const pc = BigInt(snap.pc);
  const place = lines.linePlace(Number(pc));
  const here = place ? at(place) : `0x${pc.toString(16)}`;

  if (result.cancelled || result.error) return null;
  if (result.bad_return && ctx) {
    const card = returnCard(ctx, BigInt(snap.registers[30] ?? 0));
    if (card) return { text: card.text, problem: true, card };
  }
  if (snap.blocked) return said("waiting for input");
  if (snap.halted) {
    return said(snap.exitCode == null ? "the program stopped" : `the program exited with code ${snap.exitCode}`);
  }
  if (result.hit_breakpoint) return said(`stopped at the breakpoint on ${here}`);
  if (result.step_limit_reached) {
    const goal = typeof target === "number" ? "run to cursor" : target === "over" ? "step over" : "step out";
    return said(
      `paused after ${formatSteps(result.steps_executed)}, before the ${goal} finished. ${goal} again to go on, ` +
        "or check for a loop whose exit condition never becomes true",
      true,
    );
  }
  if (!result.reached) return said(`paused at ${here}`);
  if (target === "out") return said(`returned to ${name} at ${here}`);
  return result.steps_executed > 1 ? said(`reached ${here}`) : null;
}
