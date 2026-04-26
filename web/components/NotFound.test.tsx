import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NotFound } from "./NotFound";

afterEach(() => cleanup());

describe("NotFound", () => {
  it("renders the default title and message", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("page not found");
    expect(screen.getByText(/isn.t mapped/i)).toBeTruthy();
  });

  it("uses provided overrides", () => {
    render(
      <NotFound
        title="oops"
        message="see logs"
        returnHref="/playground"
        returnLabel="go home"
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("oops");
    expect(screen.getByText("see logs")).toBeTruthy();
    const link = screen.getByRole("link", { name: "go home" });
    expect(link.getAttribute("href")).toBe("/playground");
  });

  it("includes the 404 / signal 11 marquee for atmosphere", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByText(/signal 11/i)).toBeTruthy();
  });
});
