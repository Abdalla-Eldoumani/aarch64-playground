// pins the inline icon contract: every icon is decorative (aria-hidden,
// unfocusable), draws with currentColor so the theme restyles it, and
// takes a className override for sizing.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CloseIcon, GitHubIcon, MenuIcon } from "@/components/chrome/SiteIcons";

afterEach(() => cleanup());

function svgOf(ui: React.ReactElement): SVGElement {
  const { container } = render(ui);
  return container.querySelector("svg") as SVGElement;
}

describe("SiteIcons", () => {
  it("renders every icon as a decorative, unfocusable svg", () => {
    for (const svg of [svgOf(<GitHubIcon />), svgOf(<MenuIcon />), svgOf(<CloseIcon />)]) {
      expect(svg).toBeTruthy();
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("fills the github mark with currentColor", () => {
    const svg = svgOf(<GitHubIcon />);
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.querySelector("path")).toBeTruthy();
  });

  it("strokes the menu and close glyphs with currentColor and no fill", () => {
    for (const svg of [svgOf(<MenuIcon />), svgOf(<CloseIcon />)]) {
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.querySelectorAll("line").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("sizes via the default class and lets className replace it", () => {
    expect(svgOf(<GitHubIcon />).getAttribute("class")).toBe("h-4 w-4");
    expect(svgOf(<MenuIcon />).getAttribute("class")).toBe("h-5 w-5");
    expect(svgOf(<GitHubIcon className="h-8 w-8" />).getAttribute("class")).toBe("h-8 w-8");
  });
});
