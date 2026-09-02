import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FeedbackAlert } from "@/components/practice/FeedbackAlert";

afterEach(() => cleanup());

describe("FeedbackAlert", () => {
  it("shows the explanation under a Correct label on a correct attempt", () => {
    render(<FeedbackAlert isCorrect explanation="x29 anchors the frame." hint="A hint." />);
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("x29 anchors the frame.")).toBeTruthy();
    expect(screen.queryByText("A hint.")).toBeNull();
  });

  it("shows the hint, never the explanation, on a failed attempt", () => {
    render(<FeedbackAlert isCorrect={false} explanation="The answer is 42." hint="Count again." />);
    expect(screen.getByText("Hint")).toBeTruthy();
    expect(screen.getByText("Count again.")).toBeTruthy();
    expect(screen.queryByText("The answer is 42.")).toBeNull();
  });

  it("falls back to a generic retry line when a failed attempt has no hint", () => {
    render(<FeedbackAlert isCorrect={false} explanation="Secret." />);
    expect(
      screen.getByText(
        "That is not it. Re-read the question and check each option against what the instruction actually does.",
      ),
    ).toBeTruthy();
  });

  it("announces itself as a status region", () => {
    render(<FeedbackAlert isCorrect explanation="Done." />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
