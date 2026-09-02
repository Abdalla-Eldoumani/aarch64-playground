import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FlagEffect, FLAG_SETTERS } from "@/components/diagrams/FlagEffect";

afterEach(cleanup);

describe("FlagEffect", () => {
  it("exports the panel for exactly the flag-setting entries", () => {
    expect([...FLAG_SETTERS].sort()).toEqual(
      ["adds", "ands", "cmn", "cmp", "fcmp", "subs", "tst"].sort(),
    );
  });

  it("defaults cmp to the signed vs unsigned split", () => {
    render(<FlagEffect mnemonic="cmp" />);
    expect(screen.getByLabelText("b.lt: taken")).toBeTruthy();
    expect(screen.getByLabelText("b.lo: not taken")).toBeTruthy();
    expect(screen.getByLabelText("N negative: 1")).toBeTruthy();
    expect(screen.getByLabelText("C carry: 1")).toBeTruthy();
  });

  it("recomputes the verdicts when an operand changes", () => {
    render(<FlagEffect mnemonic="cmp" />);
    fireEvent.change(screen.getByLabelText("w9"), { target: { value: "5" } });
    // 5 vs 1: greater both ways.
    expect(screen.getByLabelText("b.gt: taken")).toBeTruthy();
    expect(screen.getByLabelText("b.hi: taken")).toBeTruthy();
    expect(screen.getByLabelText("b.lt: not taken")).toBeTruthy();
  });

  it("width toggle changes the sign reading of the same bits", () => {
    render(<FlagEffect mnemonic="cmp" />);
    fireEvent.change(screen.getByLabelText("w9"), {
      target: { value: "0x80000000" },
    });
    fireEvent.change(screen.getByLabelText("w10"), { target: { value: "0" } });
    // As a w value the sign bit is set: 0x80000000 - 0 is negative.
    expect(screen.getByLabelText("N negative: 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "x 64-bit" }));
    // As an x value the same bits are a small positive number.
    expect(screen.getByLabelText("N negative: 0")).toBeTruthy();
    expect(screen.getByLabelText("x9")).toBeTruthy();
  });

  it("shows the input hint instead of verdicts on a non-number", () => {
    render(<FlagEffect mnemonic="cmp" />);
    fireEvent.change(screen.getByLabelText("w9"), {
      target: { value: "ten" },
    });
    expect(screen.queryByLabelText("flags")).toBeNull();
    expect(screen.getByText(/decimal or 0x hex/)).toBeTruthy();
  });

  it("fcmp mode has no width toggle and explains the unordered case", () => {
    render(<FlagEffect mnemonic="fcmp" />);
    expect(screen.queryByRole("group", { name: "operand width" })).toBeNull();
    // Default 0.3 vs 0.5: below.
    expect(screen.getByLabelText("b.lt: taken")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("d16"), {
      target: { value: "nan" },
    });
    expect(screen.getByLabelText("C carry: 1")).toBeTruthy();
    expect(screen.getByLabelText("V overflow: 1")).toBeTruthy();
    expect(screen.getByText(/unordered/)).toBeTruthy();
  });

  it("discard note appears for the compare aliases and not for subs", () => {
    render(<FlagEffect mnemonic="cmp" />);
    expect(screen.getByText(/result is discarded/)).toBeTruthy();
    cleanup();
    render(<FlagEffect mnemonic="subs" />);
    expect(screen.getByText(/result is written/)).toBeTruthy();
  });

  it("renders the b.cond jump link only when the mount passes an anchor", () => {
    render(<FlagEffect mnemonic="cmp" />);
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    render(<FlagEffect mnemonic="cmp" condHref="#b-cond" />);
    const link = screen.getByRole("link", { name: /see b\.cond/ });
    expect(link.getAttribute("href")).toBe("#b-cond");
  });
});
