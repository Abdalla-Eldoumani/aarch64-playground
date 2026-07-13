// pins the kicker contract: the section number renders in the amber
// machine ink, the title follows in the same mono strip, and the
// trailing hairline is decorative so screen readers hear only the text.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Kicker } from "@/components/ui/Kicker";

afterEach(() => cleanup());

describe("Kicker", () => {
  it("renders the number and the title as one strip of text", () => {
    const { container } = render(<Kicker number="01" title="overview" />);
    expect(container.textContent).toContain("01");
    expect(container.textContent).toContain("· overview");
  });

  it("inks the number amber and the title tertiary", () => {
    render(<Kicker number="4.3" title="registers" />);
    expect(screen.getByText("4.3").className).toContain("text-[var(--amber)]");
    expect(screen.getByText(/· registers/).className).toContain(
      "text-[var(--text-tertiary)]",
    );
  });

  it("hides the trailing hairline from assistive tech", () => {
    const { container } = render(<Kicker number="02" title="memory" />);
    const rule = container.querySelector('[aria-hidden="true"]');
    expect(rule).not.toBeNull();
    expect(rule?.textContent).toBe("");
  });

  it("passes className through to the wrapper", () => {
    const { container } = render(
      <Kicker number="03" title="stack" className="mt-8" />,
    );
    expect((container.firstChild as HTMLElement).className).toContain("mt-8");
  });
});
