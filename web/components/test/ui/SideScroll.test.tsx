import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SideScroll } from "@/components/ui/SideScroll";

const matches = Element.prototype.matches;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // jsdom has no scrollIntoView; each test installs its own.
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

/** jsdom never reports :focus-visible, so a test says how focus arrived. */
function focusFrom(source: "keyboard" | "pointer") {
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    return selector === ":focus-visible" ? source === "keyboard" : matches.call(this, selector);
  });
}

function row() {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  render(
    <SideScroll as="ul" scrollerClassName="flex" fadeClassName="from-[var(--bg)]">
      <li>
        <button type="button">imm6</button>
      </li>
    </SideScroll>,
  );
  return scrollIntoView;
}

describe("SideScroll", () => {
  it("brings an item focused from the keyboard to the nearest edge, padded clear of the fade", () => {
    focusFrom("keyboard");
    const scrollIntoView = row();
    screen.getByRole("button", { name: "imm6" }).focus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(screen.getByRole("list").className).toContain("scroll-pr-8");
  });

  it("leaves a tapped or clicked item where it is, under the pointer", () => {
    focusFrom("pointer");
    const scrollIntoView = row();
    screen.getByRole("button", { name: "imm6" }).focus();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("leaves the row alone when the scroller itself takes focus", () => {
    focusFrom("keyboard");
    const scrollIntoView = row();
    const list = screen.getByRole("list");
    list.tabIndex = 0;
    list.focus();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing in a browser without scrollIntoView", () => {
    focusFrom("keyboard");
    row();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    expect(() => screen.getByRole("button", { name: "imm6" }).focus()).not.toThrow();
  });
});
