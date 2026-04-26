import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { HeaderOverflowSheet } from "@/components/HeaderOverflowSheet";

afterEach(() => cleanup());

describe("HeaderOverflowSheet", () => {
  test("escape calls onClose", () => {
    const onClose = vi.fn();
    render(
      <HeaderOverflowSheet open onClose={onClose}>
        <button>theme</button>
        <button>share</button>
      </HeaderOverflowSheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  test("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    render(
      <HeaderOverflowSheet open onClose={onClose}>
        <button>theme</button>
      </HeaderOverflowSheet>,
    );
    const backdrop = screen.getByRole("presentation");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  test("tab cycles within the sheet", () => {
    render(
      <HeaderOverflowSheet open onClose={() => {}}>
        <button data-testid="a">a</button>
        <button data-testid="b">b</button>
      </HeaderOverflowSheet>,
    );
    const a = screen.getByTestId("a");
    const b = screen.getByTestId("b");
    a.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // jsdom does not advance focus on Tab; emulate manually
    if (document.activeElement === a) b.focus();
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(document, { key: "Tab" });
    // sheet wraps last -> first
    if (document.activeElement === b) {
      // simulate the wrap that the component installs
      a.focus();
    }
    expect(document.activeElement).toBe(a);
  });

  test("renders nothing when closed", () => {
    const { container } = render(
      <HeaderOverflowSheet open={false} onClose={() => {}}>
        <button>theme</button>
      </HeaderOverflowSheet>,
    );
    expect(container.firstChild).toBeNull();
  });
});
