import { describe, expect, it, vi } from "vitest";
import { withHeadlessMachine } from "@/lib/emulator/headless-run";

// The page's one headless machine and the queue in front of it: a failure,
// in the load or in a use, ends that use alone. The real programs run in
// check-runner.playground.

const loadEmulator = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/emulator/emulator", () => ({ loadEmulator }));

describe("withHeadlessMachine", () => {
  it("rejects a use whose load failed, and loads again for the next", async () => {
    loadEmulator.mockRejectedValueOnce(new Error("offline"));
    await expect(withHeadlessMachine(async () => 1)).rejects.toThrow("offline");
    await expect(withHeadlessMachine(async () => 2)).resolves.toBe(2);
    expect(loadEmulator).toHaveBeenCalledTimes(2);
  });

  it("runs the next use after one that threw", async () => {
    const failed = withHeadlessMachine(async () => {
      throw new Error("bad run");
    });
    const next = withHeadlessMachine(async () => 3);
    await expect(failed).rejects.toThrow("bad run");
    await expect(next).resolves.toBe(3);
  });
});
