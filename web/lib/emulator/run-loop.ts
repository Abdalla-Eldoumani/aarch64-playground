import type { RunResultPayload } from "@/lib/worker/protocol";

/**
 * The chunked run loop both emulator hosts drive.
 *
 * A run cannot be one wasm call: the machine would hold its thread until
 * the program finished, so a pause would never be read, panels would never
 * refresh, and an endless loop would wedge the tab. Both hosts run the
 * program in bounded chunks and come up for air between them instead. They
 * used to keep private copies of that loop, which drifted; this is the one
 * copy. What the hosts genuinely differ in -- how a chunk's wasm record is
 * coerced, how a mid-run snapshot is surfaced -- arrives as injection
 * points, not as forks of the loop.
 */

/** Instructions one chunk runs before the loop comes up for air. */
export const CHUNK_STEPS = 10_000;

/**
 * What a wedged machine is reported as. A chunk that executed nothing while
 * claiming to be neither halted, blocked, nor stopped at a breakpoint can
 * only repeat forever, so the loop stops and says so rather than re-issuing
 * chunks at full speed against a stuck CPU.
 */
export const NO_PROGRESS_ERROR =
  "the emulator made no progress and was stopped. this is a playground bug: press 'copy diagnostic bundle' and open an issue with what it copies";

/**
 * The machine the loop drives plus the two facts only the host knows:
 * whether a pause has landed, and which machine generation is current.
 */
export interface RunLoopHost {
  /**
   * Run at most `steps` instructions and report what stopped the chunk.
   * The worker coerces wasm-bindgen's bigint fields here; the main thread's
   * typed wrapper already has.
   */
  runChunk(steps: number): RunResultPayload;
  /** Whether the machine is parked on a blocking read. */
  isBlocked(): boolean;
  /** The host's pause flag. The host clears it before the run starts. */
  isPauseRequested(): boolean;
  /**
   * The host's machine generation, bumped by every operation that replaces
   * the machine (reset, assemble, loadState, stepBack).
   */
  currentEpoch(): number;
  /** One chunk executed: the host advances its snapshot frame counter. */
  onChunk(): void;
  /** Emit a mid-run snapshot to whoever is watching. */
  onHeartbeat(): void;
}

export interface RunLoopOptions {
  /**
   * Milliseconds between heartbeats; 0 emits one per chunk. The worker
   * spends 50 here because each of its heartbeats is a postMessage, and a
   * storm of them floods the very thread the pacing exists to keep
   * responsive. Nothing else hangs off this pace: the pause and epoch reads
   * happen every chunk either way.
   */
  heartbeatIntervalMs?: number;
  /** Hand the event loop back. Injectable so tests stay deterministic. */
  yieldToHost?: () => Promise<void>;
  /** Monotonic clock behind the heartbeat pace. */
  now?: () => number;
}

/**
 * Drive `maxSteps` instructions in chunks, yielding between them, and fold
 * the whole run into one result.
 */
export async function runChunked(
  host: RunLoopHost,
  maxSteps: number,
  options: RunLoopOptions = {},
): Promise<RunResultPayload> {
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 0;
  const yieldToHost = options.yieldToHost ?? yieldToEventLoop;
  const now = options.now ?? defaultNow;
  const epoch = host.currentEpoch();
  let totalSteps = 0;
  let lastHeartbeat = now();
  let result: RunResultPayload = {
    pc: 0,
    halted: false,
    steps_executed: 0,
    hit_breakpoint: false,
    error: null,
  };
  while (totalSteps < maxSteps) {
    const chunk = host.runChunk(Math.min(CHUNK_STEPS, maxSteps - totalSteps));
    totalSteps += chunk.steps_executed;
    result = chunk;
    host.onChunk();
    if (chunk.error || chunk.halted || chunk.hit_breakpoint) break;
    // A nanosleep pause belongs to the driver: hand the result up so it can
    // wait the requested time in real time, then run again.
    if (chunk.sleep_ms != null) break;
    if (host.isBlocked()) break;
    if (chunk.steps_executed === 0) {
      // A fresh object, never a write into the record the host handed back:
      // that record is the host's to own.
      result = { ...chunk, error: NO_PROGRESS_ERROR };
      break;
    }
    const at = now();
    if (at - lastHeartbeat >= heartbeatIntervalMs) {
      lastHeartbeat = at;
      host.onHeartbeat();
    }
    // The yield is the only opening a pause request or a machine-replacing
    // operation has, so both are read right after it and on every chunk: a
    // stale run must stop driving a machine that no longer exists, and a
    // student who pressed pause must not watch the rest of the budget run.
    await yieldToHost();
    if (epoch !== host.currentEpoch()) {
      result = { ...result, cancelled: true };
      break;
    }
    if (host.isPauseRequested()) break;
  }
  return {
    ...result,
    // The caller counts the whole run, not the last chunk.
    steps_executed: totalSteps,
    // Falling out of the loop with nothing else to report means the budget
    // alone stopped the run; without saying so, an endless loop reads as a
    // clean finish. A run the student paused is not a budget stop.
    step_limit_reached:
      totalSteps >= maxSteps &&
      !host.isPauseRequested() &&
      !result.halted &&
      !result.hit_breakpoint &&
      !result.error &&
      result.sleep_ms == null &&
      !host.isBlocked(),
  };
}

function defaultNow(): number {
  return performance.now();
}

// One channel serves every yield; waiters resolve in the order they were
// queued, so concurrent loops cannot cross wires.
const yieldWaiters: Array<() => void> = [];
let yieldChannel: MessageChannel | null = null;

/**
 * Hand the event loop one turn. MessageChannel rather than setTimeout(0):
 * HTML clamps a nested setTimeout to 4ms once the chain is five deep, and
 * this loop yields after every chunk, so the clamp alone would cost more
 * than the chunk it separates. setTimeout is the fallback where no
 * MessageChannel exists.
 */
function yieldToEventLoop(): Promise<void> {
  const channel = ensureYieldChannel();
  if (!channel) {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return new Promise<void>((resolve) => {
    yieldWaiters.push(resolve);
    channel.port2.postMessage(null);
  });
}

function ensureYieldChannel(): MessageChannel | null {
  if (yieldChannel) return yieldChannel;
  if (typeof MessageChannel === "undefined") return null;
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    const next = yieldWaiters.shift();
    if (next) next();
  };
  yieldChannel = channel;
  return channel;
}
