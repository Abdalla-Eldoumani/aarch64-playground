import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RouteShell } from "./RouteShell";

afterEach(() => cleanup());

describe("RouteShell", () => {
  it("renders the title as h1, the lead, and a default placeholder", () => {
    render(<RouteShell title="learn" lead="a short lead" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("learn");
    expect(screen.getByText("a short lead")).toBeTruthy();
    expect(screen.getByText(/being built/i)).toBeTruthy();
  });

  it("renders children in place of the default placeholder", () => {
    render(
      <RouteShell title="practice" lead="another lead">
        <p>custom content</p>
      </RouteShell>,
    );
    expect(screen.getByText("custom content")).toBeTruthy();
    expect(screen.queryByText(/being built/i)).toBeNull();
  });
});
