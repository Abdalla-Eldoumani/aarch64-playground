import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

afterEach(() => cleanup());

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

function Modal({ open, onClose }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return (
    <div ref={ref} data-testid="modal">
      <button data-testid="a">a</button>
      <button data-testid="b">b</button>
      <button data-testid="c">c</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  test("escape calls onClose", () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  test("focuses first focusable on open", () => {
    render(<Modal open onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByTestId("a"));
  });

  test("Tab on last wraps to first", () => {
    render(<Modal open onClose={() => {}} />);
    const a = screen.getByTestId("a");
    const c = screen.getByTestId("c");
    c.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(a);
  });

  test("Shift+Tab on first wraps to last", () => {
    render(<Modal open onClose={() => {}} />);
    const a = screen.getByTestId("a");
    const c = screen.getByTestId("c");
    a.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(c);
  });

  test("does nothing when closed", () => {
    const onClose = vi.fn();
    render(<Modal open={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
