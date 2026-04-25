import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ToastHost, useToast } from "@/components/Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger() {
  const t = useToast();
  return (
    <button type="button" onClick={() => t.show("imported main.asm")}>
      fire
    </button>
  );
}

describe("Toast", () => {
  test("shows the message and hides after 3s", () => {
    vi.useFakeTimers();
    render(
      <ToastHost>
        <Trigger />
      </ToastHost>,
    );
    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByRole("status").textContent).toBe("imported main.asm");
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a second show call replaces the first message", () => {
    vi.useFakeTimers();
    function TwoFire() {
      const t = useToast();
      return (
        <>
          <button onClick={() => t.show("a")}>a</button>
          <button onClick={() => t.show("b")}>b</button>
        </>
      );
    }
    render(
      <ToastHost>
        <TwoFire />
      </ToastHost>,
    );
    act(() => {
      screen.getByText("a").click();
    });
    expect(screen.getByRole("status").textContent).toBe("a");
    act(() => {
      screen.getByText("b").click();
    });
    expect(screen.getByRole("status").textContent).toBe("b");
  });
});
