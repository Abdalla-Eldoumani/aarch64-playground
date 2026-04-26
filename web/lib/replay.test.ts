import { describe, expect, it } from "vitest";
import { ReplayRing, type ReplayFrame } from "./replay";

function frame(stepCount: number): ReplayFrame {
  return {
    stepCount,
    registers: Array(31).fill("0x0"),
    pc: 0x400000 + stepCount * 4,
    nzcv: 0,
    changedRegs: [],
    currentLine: stepCount,
  };
}

describe("ReplayRing", () => {
  it("starts empty", () => {
    const ring = new ReplayRing(8);
    expect(ring.size()).toBe(0);
    expect(ring.range()).toEqual([]);
    expect(ring.at(0)).toBeNull();
  });

  it("pushes frames in order", () => {
    const ring = new ReplayRing(8);
    ring.push(frame(1));
    ring.push(frame(2));
    expect(ring.size()).toBe(2);
    expect(ring.at(0)?.stepCount).toBe(1);
    expect(ring.at(1)?.stepCount).toBe(2);
  });

  it("evicts oldest when capacity is exceeded", () => {
    const ring = new ReplayRing(3);
    ring.push(frame(1));
    ring.push(frame(2));
    ring.push(frame(3));
    ring.push(frame(4));
    expect(ring.size()).toBe(3);
    expect(ring.at(0)?.stepCount).toBe(2);
    expect(ring.at(2)?.stepCount).toBe(4);
  });

  it("clear empties the ring", () => {
    const ring = new ReplayRing(8);
    ring.push(frame(1));
    ring.clear();
    expect(ring.size()).toBe(0);
    expect(ring.range()).toEqual([]);
  });

  it("range returns frames in oldest-to-newest order", () => {
    const ring = new ReplayRing(3);
    ring.push(frame(1));
    ring.push(frame(2));
    ring.push(frame(3));
    expect(ring.range().map((f) => f.stepCount)).toEqual([1, 2, 3]);
  });
});
