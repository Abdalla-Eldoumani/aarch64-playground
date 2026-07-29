// Pins the b.cond condition-code explorer: the ten-course-code set, the
// taken() truth of each formula against literal flag states, the pick ->
// detail -> live-compare flow, the read-vs-ignored flag dimming, and the
// per-code operand defaults that reset when the pick changes.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  CondCodeExplorer,
  COND_CODES,
} from "@/components/diagrams/CondCodeExplorer";

afterEach(cleanup);

describe("COND_CODES", () => {
  it("carries exactly the ten course codes in their three groups", () => {
    expect(COND_CODES.map((c) => c.code)).toEqual([
      "eq", "ne", "lt", "le", "gt", "ge", "lo", "ls", "hi", "hs",
    ]);
    expect(
      COND_CODES.filter((c) => c.group === "either sign").map((c) => c.code),
    ).toEqual(["eq", "ne"]);
    expect(
      COND_CODES.filter((c) => c.group === "signed").map((c) => c.code),
    ).toEqual(["lt", "le", "gt", "ge"]);
    expect(
      COND_CODES.filter((c) => c.group === "unsigned").map((c) => c.code),
    ).toEqual(["lo", "ls", "hi", "hs"]);
  });

  // Literal flag states, not recomputed: cmp -1, 1 at 32 bits leaves
  // n=1 z=0 c=1 v=0 -- the classic signed-below / unsigned-above split.
  const SPLIT = { n: true, z: false, c: true, v: false };
  // cmp 5, 5 leaves n=0 z=1 c=1 v=0.
  const EQUAL = { n: false, z: true, c: true, v: false };
  // cmp 3, 5 borrows: n=1 z=0 c=0 v=0 -- below in both readings.
  const BELOW = { n: true, z: false, c: false, v: false };

  it("splits signed from unsigned on cmp -1, 1", () => {
    const by = Object.fromEntries(COND_CODES.map((c) => [c.code, c]));
    expect(by.lt.taken(SPLIT)).toBe(true);
    expect(by.le.taken(SPLIT)).toBe(true);
    expect(by.lo.taken(SPLIT)).toBe(false);
    expect(by.ls.taken(SPLIT)).toBe(false);
    expect(by.hi.taken(SPLIT)).toBe(true);
    expect(by.hs.taken(SPLIT)).toBe(true);
    expect(by.eq.taken(SPLIT)).toBe(false);
    expect(by.ne.taken(SPLIT)).toBe(true);
  });

  it("takes exactly the at-most family on equality", () => {
    const takenCodes = COND_CODES.filter((c) => c.taken(EQUAL)).map(
      (c) => c.code,
    );
    expect(takenCodes.sort()).toEqual(["eq", "ge", "hs", "le", "ls"].sort());
  });

  it("agrees across readings when the compare borrows", () => {
    const by = Object.fromEntries(COND_CODES.map((c) => [c.code, c]));
    expect(by.lt.taken(BELOW)).toBe(true);
    expect(by.lo.taken(BELOW)).toBe(true);
    expect(by.gt.taken(BELOW)).toBe(false);
    expect(by.hi.taken(BELOW)).toBe(false);
  });
});

describe("CondCodeExplorer", () => {
  it("starts on eq with its defaults answering taken", () => {
    render(<CondCodeExplorer />);
    const eqChip = screen.getByRole("button", { name: "b.eq" });
    expect(eqChip.getAttribute("aria-pressed")).toBe("true");
    // eq defaults 7 vs 7: equal, z read and lit, verdict taken.
    expect(
      screen.getByLabelText("Z zero: 1, read by b.eq"),
    ).toBeTruthy();
    expect(screen.getByLabelText("b.eq: taken")).toBeTruthy();
    expect(screen.getByText(/find the two values equal/)).toBeTruthy();
  });

  it("picking lt shows the signed story and dims the flags it ignores", () => {
    render(<CondCodeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "b.lt" }));
    // lt defaults -1 vs 1: signed below, so taken.
    expect(screen.getByLabelText("b.lt: taken")).toBeTruthy();
    expect(screen.getByText("taken when n ≠ v")).toBeTruthy();
    // the carry flag is set by this compare but lt never reads it.
    expect(
      screen.getByLabelText("C carry: 1, ignored by b.lt"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("N negative: 1, read by b.lt"),
    ).toBeTruthy();
    // the counterpart line names the unsigned twin.
    expect(screen.getByText(/b\.lo asks the same question/)).toBeTruthy();
  });

  it("lo on the same default operands is the teaching point: not taken", () => {
    render(<CondCodeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "b.lo" }));
    expect(screen.getByLabelText("b.lo: not taken")).toBeTruthy();
    expect(screen.getByText(/falls through/)).toBeTruthy();
  });

  it("recomputes the verdict when an operand changes", () => {
    render(<CondCodeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "b.lt" }));
    fireEvent.change(screen.getByLabelText("w9"), { target: { value: "5" } });
    // 5 vs 1 is not below in the signed reading.
    expect(screen.getByLabelText("b.lt: not taken")).toBeTruthy();
  });

  it("keeps edits per code and presents each code's own defaults", () => {
    render(<CondCodeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "b.lt" }));
    fireEvent.change(screen.getByLabelText("w9"), { target: { value: "5" } });
    // switching codes surfaces gt's defaults, not lt's edit.
    fireEvent.click(screen.getByRole("button", { name: "b.gt" }));
    expect((screen.getByLabelText("w9") as HTMLInputElement).value).toBe("9");
    // and lt's edit survives the round trip.
    fireEvent.click(screen.getByRole("button", { name: "b.lt" }));
    expect((screen.getByLabelText("w9") as HTMLInputElement).value).toBe("5");
  });

  it("shows a calm hint instead of verdicts on a non-number", () => {
    render(<CondCodeExplorer />);
    fireEvent.change(screen.getByLabelText("w9"), {
      target: { value: "ten" },
    });
    expect(screen.queryByLabelText("flags after the compare")).toBeNull();
    expect(screen.getByText(/decimal or 0x hex/)).toBeTruthy();
  });

  it("exactly one chip is pressed at a time", () => {
    render(<CondCodeExplorer />);
    fireEvent.click(screen.getByRole("button", { name: "b.hs" }));
    const pressed = COND_CODES.filter(
      (c) =>
        screen
          .getByRole("button", { name: `b.${c.code}` })
          .getAttribute("aria-pressed") === "true",
    );
    expect(pressed.map((c) => c.code)).toEqual(["hs"]);
  });
});
