import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NotFound } from "@/components/chrome/NotFound";

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

  it("includes the 0x404 doc rule and mono gloss for atmosphere", () => {
    render(<NotFound />);
    expect(screen.getByText("0x00000404")).toBeTruthy();
    expect(screen.getByText(/signal 11/i)).toBeTruthy();
    expect(screen.getByText("b 0x404 -- branch target does not exist")).toBeTruthy();
  });

  it("is the skip link's target on the 404 route", () => {
    render(<NotFound />);
    const main = screen.getByRole("main");
    expect(main.getAttribute("id")).toBe("main");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });
});
