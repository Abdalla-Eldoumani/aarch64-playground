import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MobileLayout } from "@/components/MobileLayout";

describe("MobileLayout", () => {
  test("tab strip is the last child of the root", () => {
    const { container } = render(
      <MobileLayout
        editor={<div data-testid="ed" />}
        disassembly={<div />}
        registers={<div />}
        memory={<div />}
        stack={<div />}
        console={<div />}
      />,
    );
    const root = container.firstChild as HTMLElement;
    const last = root.lastChild as HTMLElement;
    expect(last.getAttribute("role")).toBe("tablist");
  });
});
