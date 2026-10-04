// pins the doc-rule header strip: the site's one name at every width, the
// sheet section shows when given, and omitted segments simply do not render.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DocRule } from "@/components/ui/DocRule";
import { SITE_NAME } from "@/lib/content/site";

afterEach(() => cleanup());

describe("DocRule", () => {
  // Phones once read a made-up short code; the name fits a 320px screen.
  it("names the site the same way at every width", () => {
    render(<DocRule />);
    const name = screen.getByText(SITE_NAME);
    expect(name.className).not.toMatch(/hidden/);
    expect(screen.queryByText("aarch64-pg")).toBeNull();
  });

  it("renders the section segment when given", () => {
    render(<DocRule section="SECTION 4 · LEARN" />);
    expect(screen.getByText("SECTION 4 · LEARN")).toBeTruthy();
  });

  it("renders the right-aligned context segment when given", () => {
    render(<DocRule context="CPSC 355 STUDY AID" />);
    expect(screen.getByText("CPSC 355 STUDY AID")).toBeTruthy();
  });

  it("drops the section and context segments entirely when omitted", () => {
    const { container } = render(<DocRule />);
    // only the product-name span remains inside the strip row
    const strip = container.firstChild as HTMLElement;
    const row = strip.firstElementChild as HTMLElement;
    expect(row.querySelectorAll(":scope > span").length).toBe(1);
  });

  it("passes className through to the strip", () => {
    const { container } = render(<DocRule className="mb-6" />);
    expect((container.firstChild as HTMLElement).className).toContain("mb-6");
  });
});
