import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SideScroll } from "@/components/ui/SideScroll";

afterEach(() => {
  cleanup();
  // jsdom has no scrollIntoView; each test installs its own.
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

function row() {
  return render(
    <SideScroll as="ul" scrollerClassName="flex" fadeClassName="from-[var(--bg)]">
      <li>
        <button type="button">imm6</button>
      </li>
    </SideScroll>,
  );
}

describe("SideScroll", () => {
  it("brings a focused item to the nearest edge, padded clear of the fade", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    row();
    screen.getByRole("button", { name: "imm6" }).focus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(screen.getByRole("list").className).toContain("scroll-pr-8");
  });

  it("leaves the row alone when the scroller itself takes focus", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    row();
    const list = screen.getByRole("list");
    list.tabIndex = 0;
    list.focus();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
