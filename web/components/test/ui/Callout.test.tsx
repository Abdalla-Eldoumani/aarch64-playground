import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Callout } from "@/components/ui/Callout";

afterEach(() => {
  cleanup();
});

describe("Callout", () => {
  it("renders its children", () => {
    render(
      <Callout type="note">
        <code>x29</code> is the frame pointer
      </Callout>,
    );
    expect(screen.getByText("is the frame pointer", { exact: false })).toBeTruthy();
    expect(screen.getByText("x29")).toBeTruthy();
  });

  it("labels each variant", () => {
    render(<Callout type="pitfall">careful</Callout>);
    expect(screen.getByText("pitfall")).toBeTruthy();
  });

  it("takes a label of its own in place of the variant's", () => {
    render(
      <Callout type="note" label="answers">
        seven
      </Callout>,
    );
    expect(screen.getByText("answers")).toBeTruthy();
    expect(screen.queryByText("note")).toBeNull();
  });
});
