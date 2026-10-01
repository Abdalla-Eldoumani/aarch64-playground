// Pins the contents nav: one navigation landmark whose links jump to the
// given ids, numbered, in a folded copy (shown under lg) and a rail copy
// (shown from lg up).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { OnThisPage } from "@/components/ui/OnThisPage";

afterEach(cleanup);

const SECTIONS = [
  { id: "first", label: "First part", number: "01" },
  { id: "second", label: "Second part", number: "02" },
];

describe("OnThisPage", () => {
  it("is one navigation landmark named On this page", () => {
    render(<OnThisPage sections={SECTIONS} />);
    expect(screen.getAllByRole("navigation").length).toBe(1);
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
  });

  it("links each section by its id, with its number, in both copies", () => {
    render(<OnThisPage sections={SECTIONS} />);
    const links = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#first", "#second", "#first", "#second"]);
    expect(links[0].textContent).toBe("01First part");
  });

  it("folds the small-screen copy and hides it from lg up", () => {
    const { container } = render(<OnThisPage sections={SECTIONS} />);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.className).toContain("lg:hidden");
    const rail = container.querySelector("nav > div")!;
    expect(rail.className).toContain("hidden");
    expect(rail.className).toContain("lg:block");
  });
});
