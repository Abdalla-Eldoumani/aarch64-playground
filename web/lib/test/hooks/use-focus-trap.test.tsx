import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { closeOnBackdropClick, useFocusTrap } from "@/lib/hooks/use-focus-trap";

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

describe("useFocusTrap and a double press of Enter or Space", () => {
  function KeyedModal({ onKey }: { onKey: (key: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(true, ref, () => {});
    return (
      <div ref={ref}>
        <button data-testid="first" onKeyDown={(e) => onKey(e.key)}>
          close
        </button>
      </div>
    );
  }

  test("holds back Enter and Space right after opening", () => {
    const onKey = vi.fn();
    render(<KeyedModal onKey={onKey} />);
    const first = screen.getByTestId("first");
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.keyDown(first, { key: " " });
    expect(onKey).not.toHaveBeenCalled();
  });

  test("lets them through once the reader presses another key", () => {
    const onKey = vi.fn();
    render(<KeyedModal onKey={onKey} />);
    const first = screen.getByTestId("first");
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(first, { key: "Enter" });
    expect(onKey).toHaveBeenLastCalledWith("Enter");
  });

  test("lets them through once the double-press interval has passed", () => {
    let now = 1000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      const onKey = vi.fn();
      render(<KeyedModal onKey={onKey} />);
      now += 600;
      fireEvent.keyDown(screen.getByTestId("first"), { key: "Enter" });
      expect(onKey).toHaveBeenCalledWith("Enter");
    } finally {
      clock.mockRestore();
    }
  });

  test("holds back the repeats of a key held down since the opener", () => {
    let now = 1000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    try {
      const onKey = vi.fn();
      render(<KeyedModal onKey={onKey} />);
      now += 900;
      fireEvent.keyDown(screen.getByTestId("first"), { key: "Enter", repeat: true });
      expect(onKey).not.toHaveBeenCalled();
      // Released and pressed again: a deliberate press goes through.
      fireEvent.keyUp(screen.getByTestId("first"), { key: "Enter" });
      fireEvent.keyDown(screen.getByTestId("first"), { key: "Enter" });
      expect(onKey).toHaveBeenCalledWith("Enter");
    } finally {
      clock.mockRestore();
    }
  });
});

describe("closeOnBackdropClick", () => {
  test("a single click closes, the second click of a double press does not", () => {
    const onClose = vi.fn();
    render(<div data-testid="backdrop" onClick={closeOnBackdropClick(onClose)} />);
    const backdrop = screen.getByTestId("backdrop");
    fireEvent.click(backdrop, { detail: 2 });
    fireEvent.click(backdrop, { detail: 3 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(backdrop, { detail: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
    // A click with no press count (an assistive tool's synthetic click) still closes.
    fireEvent.click(backdrop, { detail: 0 });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
