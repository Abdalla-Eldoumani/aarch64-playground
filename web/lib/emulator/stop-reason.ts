import type { StepTarget } from "@/lib/emulator/emulator-state";
import type { FrameLayoutPayload } from "@/lib/emulator/frame-data";
import { decodeFrameLayout, decodeFrames, LR_UNSAVED } from "@/lib/emulator/stack-frames";
import type { RunResultPayload, StateSnapshot } from "@/lib/worker/protocol";

/** Why a goal run stopped; `problem` is a bug in the program, said as an error. */
export interface StopWords {
  text: string;
  problem: boolean;
}

/**
 * Why a step over, step out or run to cursor stopped, in the words the
 * controls and the terminal show. The hub imports this on the first such
 * stop, so a page that never steps over never loads it. Null when there is
 * nothing to add: the error line already says why, or a step over moved one
 * instruction.
 */
export function stopReason(
  target: StepTarget,
  result: RunResultPayload,
  snap: StateSnapshot,
  layout: FrameLayoutPayload | null,
  lineLabel: (addr: number) => string | null,
): StopWords | null {
  const said = (text: string, problem = false): StopWords => ({ text, problem });
  const stack = snap.frames ? decodeFrames(snap.frames) : null;
  const functions = layout ? decodeFrameLayout(layout)?.functions : undefined;
  const innermost = stack?.frames.at(-1);
  const name = innermost
    ? (functions?.find((f) => f.entry === innermost.entry)?.name ?? "this function")
    : "this function";
  const pc = BigInt(snap.pc);
  const here = lineLabel(Number(pc)) ?? `0x${pc.toString(16)}`;

  if (result.cancelled || result.error) return null;
  if (result.bad_return && stack?.badReturn && innermost) {
    const from = innermost.index === 0 ? "the C runtime" : "its caller";
    const cause = innermost.lrHit
      ? `, because ${lineLabel(innermost.lrHit.pc) ?? "a store"} overwrote the saved lr in ${name}'s frame`
      : innermost.flags & LR_UNSAVED
        ? `, because ${name} made a call before saving lr`
        : "";
    const ret = lineLabel(stack.badReturn.pc) ?? "its last line";
    return said(`${name}'s ret on ${ret} jumped to 0x${pc.toString(16)} instead of going back to ${from}${cause}`, true);
  }
  if (snap.blocked) return said("waiting for input");
  if (snap.halted) {
    return said(snap.exitCode == null ? "the program stopped" : `the program exited with code ${snap.exitCode}`);
  }
  if (result.hit_breakpoint) return said(`stopped at the breakpoint on ${here}`);
  if (result.step_limit_reached) return said("hit the step limit");
  if (!result.reached) return said(`paused at ${here}`);
  if (target === "out") return said(`returned to ${name} at ${here}`);
  return result.steps_executed > 1 ? said(`reached ${here}`) : null;
}
