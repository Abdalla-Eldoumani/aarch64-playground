// pins the kicker contract: the section number and the title render as
// one strip of text, and the trailing hairline is decorative so screen
// readers hear only the text.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Kicker } from "@/components/ui/Kicker";

afterEach(() => cleanup());

describe("Kicker", () => {
  it("renders the number and the title as one strip of text", () => {
    const { container } = render(<Kicker number="01" title="overview" />);
    expect(container.textContent).toContain("01");
    expect(container.textContent).toContain("· overview");
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
